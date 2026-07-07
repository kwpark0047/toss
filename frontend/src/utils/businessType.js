// 업종코드(영문) → 한글 표시명 매핑
const BIZ_TYPE_LABEL = {
  korean: '한식', etc: '기타', cafe: '커피숍', pub_chicken: '호프/통닭',
  western: '경양식', bunsik: '분식', etc_restaurant: '기타 휴게',
  japanese: '일식', convenience: '편의점', chinese: '중국식',
  general_cooking: '일반조리', foreign: '외국음식', fast_food: '패스트푸드',
  pub_alcohol: '주점', chicken: '통닭(치킨)', bbq: '숯불구이',
  tea_house: '다방', sashimi: '횟집', department_store: '백화점',
  gimbap: '김밥/도시락', food_truck: '푸드트럭', buffet: '뷔페',
  ice_cream: '아이스크림', mood_pub: '감성주점', naengmyeon: '냉면집',
  family_restaurant: '패밀리레스토랑', live_cafe: '라이브카페',
  snack_shop: '과자점', traditional_tea: '전통찻집', tteok_cafe: '떡카페',
  soup_health: '탕류', station_area: '철도역사', catering: '출장조리',
  kids_cafe: '키즈카페', blowfish: '복어', theater: '극장',
  amusement_park: '유원지', hotel: '관광호텔', mobile_cooking: '이동조리',
  karaoke_pub: '단란주점', airport: '공항', highway: '고속도로',
};

/** 업종코드를 한글 표시명으로 변환. 맵핑이 없으면 원본 코드 반환 */
export function bizLabel(code) {
  return BIZ_TYPE_LABEL[code] || code;
}
