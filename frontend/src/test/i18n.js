// 테스트용 i18n 설정 — 실제 production 구조(단일 translation 네임스페이스) 미러링
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  lng: 'ko',
  fallbackLng: 'ko',
  ns: ['translation'],
  defaultNS: 'translation',
  resources: {
    ko: {
      translation: {
        auth: {
          loginSubTitle: '매장 관리 시스템 로그인',
          phone: '핸드폰 번호',
          password: '비밀번호',
          login: '로그인',
        },
        menu: {
          all_category: '전체',
          store_name_default: '매장',
          empty: '메뉴가 없습니다',
          empty_desc: '아직 등록된 메뉴가 없습니다',
          category_empty: '이 카테고리에 메뉴가 없습니다',
          kiosk_hint: '전체화면으로 보기',
          table: '테이블 {{number}}번',
          loading: '메뉴를 불러오는 중',
          no_menu: '메뉴 정보를 불러오는 중',
          please_wait: '잠시만 기다려 주세요',
          cold_start_hint: '서버가 처음 실행 중입니다',
          almost_ready: '거의 준비되었습니다',
          elapsed: '초',
          refresh: '새로고침',
        },
        order: {
          not_business_hours: '영업 시간이 아닙니다',
          item_added: '{{name}}이(가) 추가되었습니다',
          cannot_order: '주문할 수 없습니다',
          success: '주문이 완료되었습니다',
          failed: '주문에 실패했습니다',
        },
      },
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
