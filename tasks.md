# WeMarket — Tasks

## Done
- [x] 프로젝트 초기화: Express + Prisma + PostgreSQL (Supabase)
- [x] 프론트엔드: Vite + React + Tailwind + React Router + TanStack Query
- [x] QR 메뉴 · 주문 · 결제 (토스페이먼츠) 플로우 완성
- [x] KDS (Kitchen Display System) 실시간 주문 연동
- [x] Socket.IO 실시간 알림 (주문/상태변경/대기열)
- [x] Firebase Cloud Messaging 푸시 알림
- [x] 카카오 알림톡 연동
- [x] CRM: 고객 프로필·포인트·쿠폰·세그먼트·개인화
- [x] AI 엔진: 메뉴 추천·수요 예측·동적 가격·어시스턴트
- [x] 재고 관리 (입출고 히스토리, 품절 알림)
- [x] 직원 관리 (출근부, PIN, role)
- [x] 예약·대기열 시스템
- [x] 리뷰·커뮤니티 게시판
- [x] 대시보드: 정산·통계·매출 분석
- [x] 푸드트럭 모드 (GPS 위치, 실시간 세션)
- [x] 웹훅·API 키 (서드파티 개발자)
- [x] 관리자 2FA OTP
- [x] 성능 최적화 v1.1.1
  - 이미지 WebP/AVIF 자동 변환
  - 번들 분석 + 코드 분할
  - Critical CSS inlining
  - Web Vitals 모니터링 (CLS/LCP/FID)
  - 리소스 힌트 (preload/preconnect)
  - Service Worker 캐싱 전략
- [x] CI/CD: GitHub Actions (8 parallel jobs: lint, test, build, security, docker, deploy)
- [x] 인프라: Render(Backend) + Cloudflare Workers(Frontend) 배포 완료
- [x] DB enum 마이그레이션 (OrderStatus/OrderPaymentStatus/PaymentTxStatus)
- [x] Schema drift 복구 (store_link_requests.admin_note, store_customers.fcm_token)
- [x] StoreSetupWizard TableLayoutCard import 누락 수정

## Pending

### High Priority
- [ ] GitHub Secrets 설정 + CI 최초 실행
- [x] StoreSetupWizard TableLayoutCard import 누락 → 메뉴 저장 후 ReferenceError 수정 (0eda95d)
- [ ] Render 백엔드 CI 자동 배포 확인 (enum migration 후 재배포)
- [x] `StoreSetupWizard` → `TableLayoutCard` import 누락 수정 (메뉴 저장 후 `ReferenceError` 수정)
- [ ] Google Fonts woff2 preload 404 수정 (critical-css 플러그인 이슈, 빌드에 영향 없음 — fonts 정상 로딩)

### Medium Priority
- [ ] 로컬 통합 테스트 환경: PostgreSQL Docker + `npm run test`
- [ ] Playwright E2E CI 최적화
- [ ] Docker multi-stage build 최적화
- [ ] Semgrep 보안 스캔 튜닝 (false positive 제거)

### Low Priority
- [ ] 프론트엔드 번들 추가 최적화 (code splitting, tree-shaking)
- [ ] DB 인덱스 최적화 (슬로우 쿼리 분석)
- [ ] Storybook 컴포넌트 문서화
- [ ] API 문서 자동화 (Swagger/OpenAPI)
- [ ] Feature Flags 도입
- [ ] 분산 추적 (OpenTelemetry)
- [ ] 카오스 엔지니어링
- [ ] A/B 테스트 인프라
- [ ] 접근성(a11y) 감사
- [ ] i18n 완성 (일본어/중국어 번역 보강)

### Known Issues
- `responseFormatter` 기본 HTTP 상태 200 (201 누락)
- jest@^25.5.4 (구버전, 느린 실행)
- 테스트 커버리지 불균일
- 일부 middleware/utils 10줄 미만 → 통합 필요
