/**
 * 환경변수 검증 - 서버 시작 전 필수/선택 누락 확인
 *
 * - CRITICAL: 누락 시 서버 시작 불가 (DB, JWT)
 * - REQUIRED: 누락 시 일부 기능 비활성화
 * - OPTIONAL: 기본값 적용 가능
 */

const levels = {
  CRITICAL: 'CRITICAL',
  REQUIRED: 'REQUIRED',
  OPTIONAL: 'OPTIONAL',
};

const vars = [
  // CRITICAL - 서버 실행 필수
  { key: 'DATABASE_URL', level: levels.CRITICAL, desc: 'Postgres 연결 문자열' },
  { key: 'JWT_SECRET', level: levels.CRITICAL, desc: 'JWT 서명키(32자 이상)' },
  { key: 'JWT_REFRESH_SECRET', level: levels.OPTIONAL, desc: 'JWT 리프레시 서명키(누락 시 JWT_SECRET으로 자동 대체)' },

  // REQUIRED - 기능별 필수
  { key: 'SMS_API_KEY', level: levels.REQUIRED, desc: 'Coolsms SMS' },
  { key: 'SMS_API_SECRET', level: levels.REQUIRED, desc: 'Coolsms SMS' },
  { key: 'SMS_SENDER', level: levels.REQUIRED, desc: '발신번호' },
  { key: 'NAVER_CLIENT_ID', level: levels.REQUIRED, desc: 'Naver 로컬 검색' },
  { key: 'NAVER_CLIENT_SECRET', level: levels.REQUIRED, desc: 'Naver 로컬 검색' },
  { key: 'TOSS_CLIENT_KEY', level: levels.REQUIRED, desc: 'Toss Payments' },
  { key: 'TOSS_SECRET_KEY', level: levels.REQUIRED, desc: 'Toss Payments' },
  { key: 'FIREBASE_SERVICE_ACCOUNT_PATH', level: levels.REQUIRED, desc: 'Firebase Admin' },
  { key: 'FIREBASE_API_KEY', level: levels.REQUIRED, desc: 'Firebase Web' },

  // OPTIONAL - 없어도 기본 동작 가능
  { key: 'GEMINI_API_KEY', level: levels.OPTIONAL, desc: 'Gemini AI (없으면 AI 기능 비활성화)' },
  { key: 'AI_PROVIDER', level: levels.OPTIONAL, desc: 'AI 프로바이더: gemini(기본) | omniroute' },
  { key: 'OMNIROUTE_BASE_URL', level: levels.OPTIONAL, desc: 'OmniRoute 게이트웨이 URL (기본: http://localhost:20128/v1)' },
  { key: 'OMNIROUTE_MODEL', level: levels.OPTIONAL, desc: 'OmniRoute 모델명 (기본: gpt-4o-mini)' },
  { key: 'NCP_GEOCODE_KEY_ID', level: levels.OPTIONAL, desc: 'NCP 지오코드 옵션' },
  { key: 'NCP_GEOCODE_KEY', level: levels.OPTIONAL, desc: 'NCP 지오코드 옵션' },
  { key: 'CORS_ORIGIN', level: levels.OPTIONAL, desc: 'CORS 허용 오리진 (쉼표 구분, 추가 도메인)' },
  { key: 'FRONTEND_URL', level: levels.OPTIONAL, desc: '프론트엔드 URL (기본: https://toss.wemarket.workers.dev)' },
  { key: 'BACKEND_URL', level: levels.OPTIONAL, desc: '백엔드 URL (기본: https://wemarket-toss.onrender.com)' },
  { key: 'BYPASS_OTP', level: levels.OPTIONAL, desc: '개발용 OTP 우회' },
];

const missingCritical = [];
const missingRequired = [];
const missingOptional = [];

vars.forEach(({ key, level, desc }) => {
  const val = process.env[key];
  if (!val || val.startsWith('YOUR_') || val === 'change-me-to-a-long-random-string' || val === 'change-me-to-another-long-random-string') {
    switch (level) {
      case levels.CRITICAL:
        missingCritical.push({ key, desc });
        break;
      case levels.REQUIRED:
        missingRequired.push({ key, desc });
        break;
      case levels.OPTIONAL:
        missingOptional.push({ key, desc });
        break;
    }
  }
});

/**
 * checkEnv - 서버 시작 전 환경변수 검사 실행
 * @returns {{ ok: boolean, warnings: string[] }}
 */
function checkEnv() {
  const warnings = [];

  if (missingCritical.length > 0) {
    const msg = `[CRITICAL] 누락된 필수 환경변수:\n${missingCritical.map(v => `  - ${v.key} (${v.desc})`).join('\n')}`;
    console.error(msg);
    return { ok: false, warnings: [msg] };
  }

  if (missingRequired.length > 0) {
    const msg = `[WARN] 설정되지 않은 환경변수 (관련 기능 동작 안함):\n${missingRequired.map(v => `  - ${v.key} (${v.desc})`).join('\n')}`;
    console.warn(msg);
    warnings.push(msg);
  }

  if (missingOptional.length > 0) {
    missingOptional.forEach(v => {
      const line = `[INFO] ${v.key}: ${v.desc}`;
      console.info(line);
      warnings.push(line);
    });
  }

  return { ok: true, warnings };
}

module.exports = { checkEnv };