const prisma = require('../config/prisma');

/**
 * 매장별 AI 팅커벨 도우미 설정 (Prisma 기반)
 * 저장된 행이 없으면 DEFAULTS를 돌려준다. AI 추천은 유료 AI 호출이 생기므로 기본 OFF.
 */
const LANGS = ['ko', 'en', 'ja', 'zh'];
const CUSTOM_MSG_MAX = 80;

const DEFAULTS = Object.freeze({
  enabled: true,
  lang: 'ko',
  voice_enabled: true,
  large_font: false,
  custom_msg: '',
  ai_recommendation: false,
});

const toPublic = (row) => ({
  enabled: row?.enabled ?? DEFAULTS.enabled,
  lang: row?.lang ?? DEFAULTS.lang,
  voice_enabled: row?.voice_enabled ?? DEFAULTS.voice_enabled,
  large_font: row?.large_font ?? DEFAULTS.large_font,
  custom_msg: row?.custom_msg ?? DEFAULTS.custom_msg,
  ai_recommendation: row?.ai_recommendation ?? DEFAULTS.ai_recommendation,
});

/**
 * 요청 본문에서 허용 필드만 골라 검증한다. 잘못된 값이면 { error }를 돌려준다.
 */
function sanitize(body = {}) {
  const data = {};
  for (const key of ['enabled', 'voice_enabled', 'large_font', 'ai_recommendation']) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'boolean') return { error: `${key}는 true/false 값이어야 합니다.` };
    data[key] = body[key];
  }
  if (body.lang !== undefined) {
    if (!LANGS.includes(body.lang)) return { error: '지원하지 않는 언어입니다.' };
    data.lang = body.lang;
  }
  if (body.custom_msg !== undefined) {
    if (body.custom_msg !== null && typeof body.custom_msg !== 'string') {
      return { error: '인삿말은 문자열이어야 합니다.' };
    }
    const msg = (body.custom_msg || '').trim();
    if (msg.length > CUSTOM_MSG_MAX)
      return { error: `인삿말은 ${CUSTOM_MSG_MAX}자 이내로 입력해 주세요.` };
    data.custom_msg = msg || null;
  }
  return { data };
}

const TinkerbellSettings = {
  DEFAULTS,
  sanitize,

  // 매장 설정 조회 (기본값 병합)
  findByStoreId: async (storeId) => {
    const row = await prisma.store_tinkerbell_settings.findUnique({
      where: { store_id: parseInt(storeId) },
    });
    return toPublic(row);
  },

  // 매장 설정 저장
  upsert: async (storeId, data) => {
    const row = await prisma.store_tinkerbell_settings.upsert({
      where: { store_id: parseInt(storeId) },
      update: { ...data, updated_at: new Date() },
      create: { store_id: parseInt(storeId), ...data, updated_at: new Date() },
    });
    return toPublic(row);
  },
};

module.exports = TinkerbellSettings;
