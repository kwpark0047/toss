/**
 * 지원되는 언어 목록
 * ko: 한국어 (기본값)
 * en: 영어
 * ja: 일본어
 * zh: 중국어
 */
const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja', 'zh'];

/**
 * i18n 미들웨어
 * 요청의 언어 설정을 파악하여 req.lang에 저장합니다.
 * 우선순위: 1. 쿼리 파라미터 (?lang=) -> 2. Accept-Language 헤더 -> 3. 기본값 (ko)
 */
const i18nMiddleware = (req, res, next) => {
    // 1. URL 쿼리 파라미터 확인 (예: /api/products?lang=en)
    let lang = req.query.lang;

    // 2. 쿼리 파라미터가 없을 경우 브라우저 헤더(Accept-Language) 확인
    if (!lang && req.headers['accept-language']) {
        // 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' 형태에서 앞 2글자만 추출
        const acceptLang = req.headers['accept-language'].split(',')[0].trim().substring(0, 2);
        if (SUPPORTED_LANGUAGES.includes(acceptLang)) {
            lang = acceptLang;
        }
    }

    // 3. 설정된 언어가 없거나 지원하지 않는 언어인 경우 한국어('ko')를 기본값으로 사용
    if (!lang || !SUPPORTED_LANGUAGES.includes(lang)) {
        lang = 'ko';
    }

    // 요청 객체에 언어 정보 설정 (컨트롤러나 모델에서 사용 가능)
    req.lang = lang;
    next();
};

// 다국어 번역 함수 (알림톡/영수증/알림)
const { t, getAlimtalkTemplate, getNotificationTemplate, translations } = require('./i18nTranslations');

module.exports = {
    SUPPORTED_LANGUAGES,
    i18nMiddleware,
    t,
    getAlimtalkTemplate,
    getNotificationTemplate,
    translations
};
