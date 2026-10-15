# 무료 인증 릴리스 진행

인증 RC `c54c6b132ba3f5f5f004cb6d594d6cc62256ee7f`을 기존 공개 main·RC 브랜치에 fast-forward 게시했다. Render에서 정확한 커밋 배포를 시작했으나 `dep-db8460om7kps73d01d1g` 빌드가 npm ci에서 실패했다. 기존 운영 버전 a52d326은 유지됐고 health 200을 확인했다.

## 원인과 재현

Node22.22.0/npm10.9.4 Linux에서 c54c6b1의 package-lock으로 npm ci를 재현했다. `@emnapi/core@1.11.3`, `@emnapi/runtime@1.11.3` 항목 누락으로 EUSAGE가 발생했다. CI와 Security Scanning도 같은 설치 단계에서 실패했다. 테스트 assertion을 우회하거나 npm ci를 npm install로 교체하지 않았다.

비밀값이 없는 격리 폴더의 package.json·lock만 공식 Node Linux 컨테이너에 전달했다. npm10의 package-lock-only로 누락 항목 2개와 관련 peer 메타데이터를 복원했다. 기존 패키지 버전 변경 0, root 의존성 변경 0이다. 실제 Linux clean install 결과는 `free-auth-linux-lock-green.log`, 재현 로그는 `free-auth-linux-lock-red.log`에 기록한다.

로컬 SaaS 회귀 95개 통과(추가 SMTP 검증 도구 2개 포함). SMTP는 지정한 주소의 실제 수신까지 사용자 확인 완료이며 임시 비밀 환경파일은 삭제됐다. 해당 연결 검증은 회원가입 OTP/OAuth/Turnstile E2E 완료가 아니다.

## 활성화 조건

운영 auth migration·RLS·공개 접근 차단을 release 시점에 다시 확인했다. Render EMAIL_AUTH_PEPPER의 존재·최소 길이 충족·명백한 placeholder 아님을 값 출력 없이 확인했다. `FREE_AUTH_ENABLED=false`를 유지한다.

실제 신규 가입은 Google/Kakao callback·Turnstile 실제 hostname/action, 이메일 OTP/링크 소비 및 승인된 플랫폼 약관/개인정보처리방침 URL 확인 뒤 활성화해야 한다. 기존 `/legal/:storeId` 문서는 매장 문서이며 플랫폼 회원가입 약관으로 자동 지정하지 않았다.

Vercel 프로젝트는 기존 wemarket-saas/prj_ZXshlSsA2zPPNuIAhI0FtUwWwMYL임을 확인했다. 기존 배포는 cac2afa이며 push가 자동 배포를 시작하지 않아 고정 커밋의 깨끗한 export로 프론트 배포를 준비한다. 비밀 환경파일이나 미커밋 작업 트리를 업로드하지 않는다. 최종 운영 반영·SHA 증거는 후속 기록으로 구분한다.
