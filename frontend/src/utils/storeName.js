/**
 * 매장명 표시 가능 여부 판별.
 * 데이터 임포트 시 한글이 '?'(U+003F) 또는 치환문자(U+FFFD)로 깨진 이름은
 * 고객에게 알아볼 수 없는 값이므로 목록/배너/지도에서 숨긴다.
 * 백엔드에서 1차 필터링하며, 이 함수는 프론트 안전망(캐시·누락 대비)이다.
 */
export function hasCorruptName(name) {
  if (!name || typeof name !== 'string') return true; // 이름 없음도 표시 불가로 간주
  return name.includes('?') || name.includes('�');
}

/** 표시 가능한 정상 매장명이면 true */
export function isDisplayableStoreName(name) {
  return !hasCorruptName(name);
}
