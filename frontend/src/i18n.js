import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

i18n
    .use(HttpApi) // 번역 파일 로드 (public/locales)
    .use(LanguageDetector) // 브라우저 언어 감지
    .use(initReactI18next) // react-i18next 라이브러리와 연동
    .init({
        fallbackLng: 'ko', // 기본 언어 설정 (한국어)
        supportedLngs: ['ko', 'en', 'jp', 'cn'], // 파일명(jp, cn)과 일치하도록 수정
        debug: false, // 개발 모드 디버깅 끄기
        interpolation: {
            escapeValue: false, // 리액트는 XSS 보호 기능이 있으므로 필요 없음
        },
        backend: {
            loadPath: '/locales/{{lng}}.json', // 번역 파일 경로
        },
        detection: {
            order: ['localStorage', 'cookie', 'navigator'], // 언어 감지 우선순위
            caches: ['localStorage', 'cookie'], // 언어 설정 저장 위치
        }
    });

export default i18n;
