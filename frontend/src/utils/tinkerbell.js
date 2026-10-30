/**
 * tinkerbell.js — AI 팅커벨 도우미 설정
 * 실제 매장 설정은 서버(/stores/:id/tinkerbell-settings)에 저장한다.
 * localStorage 저장은 로그인 없는 데모 화면(MenuDemo)용이다.
 * 음성 안내(voiceEnabled)는 기본 ON, AI 추천은 유료 호출이 생기므로 기본 OFF.
 */
export const TINKERBELL_SETTINGS_KEY = 'wm_tinkerbell_settings';

export const DEFAULT_TINKERBELL_SETTINGS = {
  enabled: true,
  lang: 'ko',
  voiceEnabled: true,
  voiceOrderEnabled: true,
  largeFont: false,
  customMsg: '',
  aiRecommendation: false,
  aiModel: 'omniroute',
};

/** 저장된 설정 로드 (없으면 기본값). */
export function loadTinkerBellSettings() {
  try {
    const raw = localStorage.getItem(TINKERBELL_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_TINKERBELL_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* 무시 */
  }
  return { ...DEFAULT_TINKERBELL_SETTINGS };
}

/** 설정 저장. 성공 여부 반환. */
export function saveTinkerBellSettings(settings) {
  try {
    localStorage.setItem(TINKERBELL_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** 서버 응답(snake_case)을 화면용 설정(camelCase)으로 변환. */
export function fromServerTinkerBellSettings(data = {}) {
  return {
    ...DEFAULT_TINKERBELL_SETTINGS,
    enabled: data.enabled ?? DEFAULT_TINKERBELL_SETTINGS.enabled,
    lang: data.lang ?? DEFAULT_TINKERBELL_SETTINGS.lang,
    voiceEnabled: data.voice_enabled ?? DEFAULT_TINKERBELL_SETTINGS.voiceEnabled,
    voiceOrderEnabled: data.voice_order_enabled ?? DEFAULT_TINKERBELL_SETTINGS.voiceOrderEnabled,
    largeFont: data.large_font ?? DEFAULT_TINKERBELL_SETTINGS.largeFont,
    customMsg: data.custom_msg ?? DEFAULT_TINKERBELL_SETTINGS.customMsg,
    aiRecommendation: data.ai_recommendation ?? DEFAULT_TINKERBELL_SETTINGS.aiRecommendation,
  };
}

/** 화면용 설정을 서버 저장 형식으로 변환. */
export function toServerTinkerBellSettings(s) {
  return {
    enabled: s.enabled,
    lang: s.lang,
    voice_enabled: s.voiceEnabled,
    voice_order_enabled: s.voiceOrderEnabled,
    large_font: s.largeFont,
    custom_msg: s.customMsg,
    ai_recommendation: s.aiRecommendation,
  };
}
