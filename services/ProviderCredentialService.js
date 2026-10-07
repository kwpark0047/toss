const crypto = require('crypto');
const prisma = require('../config/prisma');
const { AppError } = require('../utils/errorHandler');
const { seal, open } = require('../utils/providerSecret');
const CATALOG = {
  pos: { label: 'POS', fields: ['api_key'], store: true, adapter: false },
  table_order: {
    label: '외부 키오스크·테이블오더',
    fields: ['api_key'],
    store: true,
    adapter: false,
  },
  baemin: { label: '배달 서비스', fields: ['api_key'], store: true, adapter: false },
  online_order: {
    label: '온라인·모바일 주문 업체',
    fields: ['api_key'],
    store: true,
    adapter: false,
  },
  naver: {
    label: '네이버 지역검색·플레이스',
    fields: ['client_id', 'client_secret'],
    store: true,
    adapter: true,
  },
  seoul: { label: '서울 공공데이터', fields: ['api_keys'], store: false, adapter: true },
  weather: { label: '기상청', fields: ['api_key'], store: false, adapter: true },
};
function definition(provider, storeId) {
  const item = CATALOG[provider];
  if (!item || (storeId && !item.store) || (!storeId && item.store && provider !== 'naver'))
    throw new AppError('해당 범위에서 설정할 수 없는 공급자입니다.', 400);
  return item;
}
const scope = (storeId) => (storeId ? `store:${storeId}` : 'global');
class ProviderCredentialService {
  constructor(db = prisma) {
    this.db = db;
  }
  async row(provider, storeId) {
    try {
      return (
        await this.db.$queryRawUnsafe(
          'SELECT * FROM provider_credentials WHERE scope_key=$1 AND provider=$2',
          scope(storeId),
          provider
        )
      )[0];
    } catch (error) {
      if (error.code === 'P2010' && error.meta?.code === '42P01') return null;
      throw error;
    }
  }
  environment(provider) {
    const values = {
      naver: {
        client_id: process.env.NAVER_CLIENT_ID,
        client_secret: process.env.NAVER_CLIENT_SECRET,
      },
      seoul: { api_keys: process.env.SEOUL_OPENAPI_KEYS },
      weather: { api_key: process.env.KMA_API_KEY },
    }[provider];
    return values && CATALOG[provider].fields.every((field) => values[field]?.trim())
      ? values
      : null;
  }
  async resolve(provider, storeId = null) {
    if (!CATALOG[provider]) throw new AppError('지원하지 않는 공급자입니다.', 400);
    if (storeId && CATALOG[provider].store) {
      const own = await this.row(provider, storeId);
      if (own)
        return own.enabled
          ? {
              values: open(own.secret_ciphertext, `${scope(storeId)}:${provider}`),
              source: 'store',
              revision: own.updated_at,
            }
          : null;
    }
    if (!CATALOG[provider].store || provider === 'naver') {
      const shared = await this.row(provider, null);
      if (shared)
        return shared.enabled
          ? {
              values: open(shared.secret_ciphertext, `global:${provider}`),
              source: 'global',
              revision: shared.updated_at,
            }
          : null;
      const values = this.environment(provider);
      if (values) return { values, source: 'environment', revision: 'environment' };
    }
    return null;
  }
  async list(storeId = null) {
    const result = [];
    for (const [provider, item] of Object.entries(CATALOG)) {
      if (storeId && !item.store) {
        const resolved = await this.resolve(provider);
        result.push({
          provider,
          ...item,
          fields: [],
          read_only: true,
          configured: Boolean(resolved),
          source: resolved?.source || 'none',
          masked: {},
        });
        continue;
      }
      if (storeId ? !item.store : item.store && provider !== 'naver') continue;
      const own = await this.row(provider, storeId),
        resolved = await this.resolve(provider, storeId);
      result.push({
        provider,
        ...item,
        configured: Boolean(resolved),
        source: resolved?.source || 'none',
        enabled: own?.enabled ?? true,
        registered: Boolean(own),
        updated_at: own?.updated_at || null,
        last_test_status: own?.last_test_status || 'untested',
        last_test_at: own?.last_test_at || null,
        masked: resolved
          ? Object.fromEntries(
              item.fields.map((field) => [field, '••••' + String(resolved.values[field]).slice(-4)])
            )
          : {},
      });
    }
    return result;
  }
  async save(provider, storeId, input, userId) {
    const item = definition(provider, storeId);
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((field) => ![...item.fields, 'enabled'].includes(field))
    )
      throw new AppError('인증정보 필드를 확인하세요.', 400);
    if (input.enabled != null && typeof input.enabled !== 'boolean')
      throw new AppError('enabled는 true/false입니다.', 400);
    const old = await this.row(provider, storeId);
    const values = old ? open(old.secret_ciphertext, `${scope(storeId)}:${provider}`) : {};
    for (const field of item.fields) {
      if (input[field] === undefined || input[field] === '') continue;
      if (
        typeof input[field] !== 'string' ||
        input[field].trim().length < (field === 'client_id' ? 3 : 8) ||
        input[field].length > 4096 ||
        /[\r\n]/.test(input[field])
      )
        throw new AppError(`${field} 형식과 길이를 확인하세요.`, 400);
      values[field] = input[field].trim();
      if (field === 'api_keys') {
        const keys = values[field].split(',').map((value) => value.trim());
        if (
          !keys.length ||
          keys.length > 10 ||
          keys.some((value) => value.length < 8 || !/^[\x21-\x7e]+$/.test(value))
        )
          throw new AppError('서울 API 키를 확인하세요. 최대 10개를 쉼표로 구분합니다.', 400);
        values[field] = keys.join(',');
      } else if (!/^[\x21-\x7e]+$/.test(values[field]))
        throw new AppError('인증정보에 공백이나 지원하지 않는 문자가 있습니다.', 400);
    }
    if (item.fields.some((field) => !values[field]))
      throw new AppError('필수 인증정보를 모두 입력하세요.', 400);
    await this.db.$executeRawUnsafe(
      `INSERT INTO provider_credentials(id,scope_key,store_id,provider,secret_ciphertext,enabled,updated_by)
      VALUES($1::uuid,$2,$3,$4,$5,$6,$7) ON CONFLICT(scope_key,provider) DO UPDATE SET secret_ciphertext=EXCLUDED.secret_ciphertext,enabled=EXCLUDED.enabled,updated_by=EXCLUDED.updated_by,updated_at=NOW(),last_test_status='untested',last_test_at=NULL`,
      crypto.randomUUID(),
      scope(storeId),
      storeId || null,
      provider,
      seal(values, `${scope(storeId)}:${provider}`),
      input.enabled ?? old?.enabled ?? true,
      userId
    );
    return { saved: true };
  }
  async remove(provider, storeId) {
    definition(provider, storeId);
    await this.db.$executeRawUnsafe(
      'DELETE FROM provider_credentials WHERE scope_key=$1 AND provider=$2',
      scope(storeId),
      provider
    );
    return { deleted: true };
  }
  async test(provider, storeId) {
    const item = definition(provider, storeId),
      credential = await this.resolve(provider, storeId);
    if (!credential) throw new AppError('사용 가능한 인증정보를 먼저 등록하세요.', 400);
    let status = 'adapter_required',
      message = '키가 암호화 저장되었습니다. 실제 업체 어댑터 연결과 권한 검증이 필요합니다.';
    if (item.adapter) {
      status = 'failed';
      message = '공급자 연결 검증에 실패했습니다. 키·권한·사용량 한도를 확인하세요.';
      try {
        const axios = require('axios');
        if (provider === 'naver') {
          const response = await axios.get('https://openapi.naver.com/v1/search/local.json', {
            params: { query: '서울 음식점', display: 1 },
            headers: {
              'X-Naver-Client-Id': credential.values.client_id,
              'X-Naver-Client-Secret': credential.values.client_secret,
            },
            timeout: 8000,
          });
          if (!Array.isArray(response.data?.items)) throw new Error('Invalid response');
        } else if (provider === 'seoul') {
          const key = credential.values.api_keys
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)[0];
          const response = await axios.get(
            `http://openapi.seoul.go.kr:8088/${encodeURIComponent(key)}/json/LOCALDATA_072404/1/1/`,
            { timeout: 10000 }
          );
          if (!Array.isArray(response.data?.LOCALDATA_072404?.row))
            throw new Error('Invalid response');
        } else {
          const response = await axios.get(
            'https://apihub.kma.go.kr/api/typ01/url/kma_sfctm2.php',
            { params: { stn: '108', help: 0, authKey: credential.values.api_key }, timeout: 8000 }
          );
          if (!require('./weatherService').parseSfctm2(String(response.data)))
            throw new Error('Invalid weather');
        }
        status = 'verified';
        message = '공식 공급자 조회가 정상 응답했습니다.';
      } catch {
        /* Never expose provider request URLs, headers or key-bearing error messages. */
      }
    }
    await this.db.$executeRawUnsafe(
      'UPDATE provider_credentials SET last_test_status=$1,last_test_at=NOW() WHERE scope_key=$2 AND provider=$3 AND updated_at=$4',
      status,
      scope(storeId),
      provider,
      credential.revision instanceof Date ? credential.revision : new Date(0)
    );
    return { status, message };
  }
}
module.exports = new ProviderCredentialService();
module.exports.ProviderCredentialService = ProviderCredentialService;
module.exports.CATALOG = CATALOG;
