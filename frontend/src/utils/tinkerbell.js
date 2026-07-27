/**
 * tinkerbell.js — AI 팅커벨 도우미 설정 영속화 (localStorage)
 * 음성 안내(voiceEnabled)는 기본 ON.
 */
export const TINKERBELL_SETTINGS_KEY = 'wm_tinkerbell_settings';

export const DEFAULT_TINKERBELL_SETTINGS = {
   enabled: true,
   lang: 'ko',
   voiceEnabled: true,
   largeFont: false,
   customMsg: '',
   aiRecommendation: true,
   aiModel: 'omniroute',
 };

/** 저장된 설정 로드 (없으면 기본값). */
export function loadTinkerBellSettings() {
  try {
    const raw = localStorage.getItem(TINKERBELL_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_TINKERBELL_SETTINGS, ...JSON.parse(raw) };
  } catch { /* 무시 */ }
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
