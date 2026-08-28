import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const LOCAL_UPLOAD_DIR = path.join(__dirname, '../public/uploads');

/** 확장자 화이트리스트 (fileFilter 와 이중 방어) */
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/**
 * 사용자 입력에서 안전한 파일 키를 생성한다.
 * 원본 파일명은 확장자 판별에만 사용하고, 실제 이름은 난수로 대체해
 * 경로 조작·덮어쓰기·정보 노출을 원천 차단한다.
 */
export function buildObjectKey(originalName: string, prefix = 'image'): string {
  const ext = path.extname(String(originalName || '')).toLowerCase();
  const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
  const safePrefix = String(prefix).replace(/[^a-zA-Z0-9_-]/g, '') || 'image';
  const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  return `${safePrefix}-${unique}${safeExt}`;
}

/** 키가 단일 파일명인지 검증 (경로 이탈 차단) */
export function isSafeKey(key: string): boolean {
  if (typeof key !== 'string' || key.length === 0 || key.length > 255) return false;
  if (key.includes('..') || key.includes('/') || key.includes('\\') || key.includes('\0'))
    return false;
  return path.basename(key) === key;
}

// ══════════════════════════════════════════════════════════════════
// local 드라이버
// ══════════════════════════════════════════════════════════════════

function createLocalDriver() {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }

  return {
    name: 'local',
    isRemote: false,

    async save({ buffer, originalName, prefix }: { buffer: Buffer; originalName: string; prefix?: string }) {
      const key = buildObjectKey(originalName, prefix);
      await fs.promises.writeFile(path.join(LOCAL_UPLOAD_DIR, key), buffer);
      // 로컬 드라이버는 절대 URL 을 만들 수 없으므로 상대 경로를 반환한다.
      // (요청 컨텍스트를 아는 라우트에서 호스트를 붙인다)
      return { key, url: `/uploads/${key}` };
    },

    async remove(key: string): Promise<boolean> {
      if (!isSafeKey(key)) return false;
      const base = path.resolve(LOCAL_UPLOAD_DIR);
      const target = path.resolve(base, key);
      if (!target.startsWith(base + path.sep)) return false;

      try {
        await fs.promises.unlink(target);
        return true;
      } catch (e: any) {
        if (e.code === 'ENOENT') return false;
        throw e;
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// supabase 드라이버
// ══════════════════════════════════════════════════════════════════

function createSupabaseDriver() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';

  if (!url || !serviceKey) {
    throw new Error(
      '[storage] STORAGE_DRIVER=supabase 이지만 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다.'
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    name: 'supabase',
    isRemote: true,
    bucket,

    async save({ buffer, originalName, mimeType, prefix }: { buffer: Buffer; originalName: string; mimeType?: string; prefix?: string }) {
      const key = buildObjectKey(originalName, prefix);
      const { error } = await client.storage.from(bucket).upload(key, buffer, {
        contentType: mimeType || 'application/octet-stream',
        cacheControl: '31536000', // 1년 — 키가 난수라 불변 자산으로 취급 가능
        upsert: false,
      });
      if (error) {
        throw new Error(`[storage] Supabase 업로드 실패: ${error.message}`);
      }
      const { data } = client.storage.from(bucket).getPublicUrl(key);
      return { key, url: data.publicUrl };
    },

    async remove(key: string): Promise<boolean> {
      if (!isSafeKey(key)) return false;
      const { data, error } = await client.storage.from(bucket).remove([key]);
      if (error) {
        throw new Error(`[storage] Supabase 삭제 실패: ${error.message}`);
      }
      return Array.isArray(data) && data.length > 0;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// 드라이버 선택 (지연 초기화)
// ══════════════════════════════════════════════════════════════════

let _driver: any = null;

export function getDriver() {
  if (_driver) return _driver;

  const requested = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

  if (requested === 'supabase') {
    try {
      const { createSupabaseDriver } = await import('./storageSupabase.js');
      _driver = createSupabaseDriver();
      logger.info(`[storage] Supabase Storage 드라이버 활성화 (bucket=${_driver.bucket})`);
      return _driver;
    } catch (e: any) {
      // 운영에서 설정 누락으로 업로드가 조용히 로컬로 떨어지면 재배포 시 유실된다.
      // 따라서 production 에서는 기동을 막고, 그 외에는 경고 후 로컬로 폴백한다.
      if (process.env.NODE_ENV === 'production') throw e;
      logger.warn(`${e.message} — 로컬 드라이버로 폴백합니다.`);
    }
  }

  _driver = createLocalDriver();
  if (process.env.NODE_ENV === 'production') {
    logger.warn(
      '[storage] 운영 환경에서 local 드라이버를 사용 중입니다. ' +
        '컨테이너 재배포 시 업로드 파일이 소실됩니다. STORAGE_DRIVER=supabase 설정을 권장합니다.'
    );
  }
  return _driver;
}

/** 테스트 전용 — 드라이버 캐시 초기화 */
export function _resetForTests(): void {
  _driver = null;
}

export { buildObjectKey, isSafeKey, ALLOWED_EXTENSIONS, LOCAL_UPLOAD_DIR, _resetForTests };