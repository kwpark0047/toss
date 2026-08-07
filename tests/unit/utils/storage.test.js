/**
 * utils/storage 테스트 (M-9)
 *
 * 로컬 디스크 저장은 Render 등 임시 파일시스템에서 재배포 시 유실된다.
 * 드라이버 추상화가 계약대로 동작하는지, 경로 이탈이 차단되는지 검증한다.
 */
const fs = require('fs');
const path = require('path');

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const storage = require('../../../utils/storage');
const logger = require('../../../utils/logger');

describe('buildObjectKey', () => {
  test('원본 파일명을 쓰지 않고 난수 키를 만든다', () => {
    const key = storage.buildObjectKey('내_사진.png', 'image');
    expect(key).not.toContain('내_사진');
    expect(key).toMatch(/^image-\d+-[0-9a-f]{16}\.png$/);
  });

  test('허용되지 않은 확장자는 .bin 으로 강등된다', () => {
    expect(storage.buildObjectKey('payload.php', 'image')).toMatch(/\.bin$/);
    expect(storage.buildObjectKey('shell.svg', 'image')).toMatch(/\.bin$/);
  });

  test('prefix 의 위험 문자를 제거한다', () => {
    const key = storage.buildObjectKey('a.png', '../../etc');
    expect(key.startsWith('etc-')).toBe(true);
    expect(key).not.toContain('..');
    expect(key).not.toContain('/');
  });

  test('같은 입력이라도 키가 충돌하지 않는다', () => {
    const keys = new Set(
      Array.from({ length: 200 }, () => storage.buildObjectKey('a.png', 'image'))
    );
    expect(keys.size).toBe(200);
  });
});

describe('isSafeKey', () => {
  test.each([
    ['image-1-abc.png', true],
    ['../../../etc/passwd', false],
    ['sub/dir.png', false],
    ['back\\slash.png', false],
    ['nul\0byte.png', false],
    ['', false],
    [null, false],
    ['a'.repeat(300), false],
  ])('%s → %s', (key, expected) => {
    expect(storage.isSafeKey(key)).toBe(expected);
  });
});

describe('local 드라이버', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    storage._resetForTests();
    process.env.STORAGE_DRIVER = 'local';
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test('파일을 저장하고 상대 URL 을 반환한다', async () => {
    const driver = storage.getDriver();
    expect(driver.name).toBe('local');
    expect(driver.isRemote).toBe(false);

    const { key, url } = await driver.save({
      buffer: Buffer.from('fake-png'),
      originalName: 'photo.png',
      mimeType: 'image/png',
      prefix: 'image',
    });

    expect(url).toBe(`/uploads/${key}`);
    const saved = path.join(storage.LOCAL_UPLOAD_DIR, key);
    expect(fs.existsSync(saved)).toBe(true);

    // cleanup
    await driver.remove(key);
    expect(fs.existsSync(saved)).toBe(false);
  });

  test('존재하지 않는 파일 삭제는 false 를 반환한다', async () => {
    const driver = storage.getDriver();
    await expect(driver.remove('image-0-0000000000000000.png')).resolves.toBe(false);
  });

  test('경로 이탈 키는 삭제하지 않는다', async () => {
    const driver = storage.getDriver();
    await expect(driver.remove('../../package.json')).resolves.toBe(false);
    // 실제 파일이 지워지지 않았는지 확인
    expect(fs.existsSync(path.join(__dirname, '../../../package.json'))).toBe(true);
  });
});

describe('supabase 드라이버 선택', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    storage._resetForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    storage._resetForTests();
  });

  test('설정이 없으면 개발 환경에서는 경고 후 로컬로 폴백한다', () => {
    process.env.NODE_ENV = 'development';
    process.env.STORAGE_DRIVER = 'supabase';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const driver = storage.getDriver();

    expect(driver.name).toBe('local');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('로컬 드라이버로 폴백'));
  });

  test('[중요] 운영 환경에서 설정이 없으면 기동을 막는다 (조용한 유실 방지)', () => {
    process.env.NODE_ENV = 'production';
    process.env.STORAGE_DRIVER = 'supabase';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => storage.getDriver()).toThrow(/SUPABASE_URL/);
  });

  test('운영에서 local 드라이버를 쓰면 유실 경고를 남긴다', () => {
    process.env.NODE_ENV = 'production';
    process.env.STORAGE_DRIVER = 'local';

    const driver = storage.getDriver();

    expect(driver.name).toBe('local');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('소실'));
  });
});

describe('supabase 드라이버 동작', () => {
  const ORIGINAL_ENV = { ...process.env };
  let mockUpload, mockRemove, mockGetPublicUrl;

  beforeEach(() => {
    jest.resetModules();
    mockUpload = jest.fn().mockResolvedValue({ data: { path: 'k' }, error: null });
    mockRemove = jest.fn().mockResolvedValue({ data: [{ name: 'k' }], error: null });
    mockGetPublicUrl = jest.fn(() => ({ data: { publicUrl: 'https://cdn.example/k.png' } }));

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        storage: {
          from: () => ({
            upload: mockUpload,
            remove: mockRemove,
            getPublicUrl: mockGetPublicUrl,
          }),
        },
      }),
    }));

    process.env.NODE_ENV = 'test';
    process.env.STORAGE_DRIVER = 'supabase';
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'uploads';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.dontMock('@supabase/supabase-js');
    jest.resetModules();
  });

  test('버킷에 업로드하고 공개 URL 을 반환한다', async () => {
    const s = require('../../../utils/storage');
    s._resetForTests();
    const driver = s.getDriver();

    expect(driver.name).toBe('supabase');
    expect(driver.isRemote).toBe(true);

    const result = await driver.save({
      buffer: Buffer.from('x'),
      originalName: 'a.png',
      mimeType: 'image/png',
      prefix: 'image',
    });

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^image-.*\.png$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/png', upsert: false })
    );
    expect(result.url).toBe('https://cdn.example/k.png');
  });

  test('업로드 실패 시 예외를 던진다', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'quota exceeded' } });
    const s = require('../../../utils/storage');
    s._resetForTests();

    await expect(
      s.getDriver().save({ buffer: Buffer.from('x'), originalName: 'a.png', mimeType: 'image/png' })
    ).rejects.toThrow(/quota exceeded/);
  });

  test('경로 이탈 키는 원격 삭제 API 를 호출하지 않는다', async () => {
    const s = require('../../../utils/storage');
    s._resetForTests();

    await expect(s.getDriver().remove('../secret')).resolves.toBe(false);
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
