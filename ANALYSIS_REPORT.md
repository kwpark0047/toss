# WeMarket 프로젝트 종합 분석 리포트

**분석일**: 2026-07-10  
**프로젝트**: WeMarket — SaaS QR Menu & Store Management Platform  
**버전**: 1.1.0  
**스택**: Express 5.2 / Prisma 5.22 / PostgreSQL (Supabase) + React 19 / Vite 7 / Tailwind 4

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **목적** | QR 메뉴 주문 + 매장 관리 SaaS 플랫폼 |
| **라이브** | https://wemarket.vercel.app (프론트) / https://wemarket-toss.onrender.com (백엔드) |
| **GitHub** | https://github.com/kwpark0047-iceu/250105 |
| **DB** | PostgreSQL (Supabase) — 모델 51개, Prisma 스키마 990줄 |
| **배포** | Vercel (프론트) + Render (백엔드, 싱가포르, 무료 티어) |
| **Cron** | 주간 리포트(월 09:00 KST), 뉴스 수집(매일 07:00 KST), 로그 아카이브(매월 04:00 KST) |

---

## 2. 백엔드 아키텍처 분석

### 2.1 4-레이어 아키텍처 현황

```
routes/ → controllers/ → services/ → repositories/ (Prisma)
```

| 레이어 | 파일 수 | 총 LOC | 상태 |
|--------|---------|--------|------|
| **routes/** | 39 | ~2,800 | ✅ 4개 주요 라우터 분리 완료 |
| **controllers/** | 17 | ~3,400 | ✅ 안정적 |
| **services/** | 19 | ~5,500 | ✅ 안정적 |
| **repositories/** | 19 | ~3,000 | ✅ 안정적 |
| **middleware/** | 9 | ~800 | ✅ 안정적 |
| **utils/** | 22 | ~2,500 | ✅ 안정적 |

### 2.2 라우터 분리 상태

#### ✅ 분리 완료 (4개 — 이번 세션)
| 파일 | 분리 전 | 분리 후 | Controller | Service |
|------|---------|---------|------------|---------|
| payments.js | 507줄 | 41줄 | paymentController (14개 핸들러) | PaymentService (643줄) |
| stores.js | 457줄 | 40줄 | storeController (17개 핸들러) | StoreService (258줄) |
| customers.js | 417줄 | 19줄 | customerController (9개 핸들러) | CustomerService (216줄) |
| staff.js | 486줄 | 38줄 | staffController (15개 핸들러) | StaffService (271줄) |

**총 이동 라인**: ~1,800줄 → 적절한 레이어로 분산

#### ⚠️ 분리 필요 (14개 — 인라인 비즈니스 로직 존재)
| 파일 | LOC | 복잡도 | 추천 우선순위 |
|------|-----|--------|-------------|
| ai.js | 252 | 🔴 높음 | 1순위 |
| boards.js | 246 | 🔴 높음 | 1순위 |
| legal.js | 245 | 🟡 중간 | 2순위 |
| v1.js | 166 | 🟡 중간 | 2순위 |
| points.js | 162 | 🟡 중간 | 2순위 |
| analytics.js | 152 | 🟡 중간 | 2순위 |
| reviews.js | 126 | 🟡 중간 | 3순위 |
| developer.js | 102 | 🟢 낮음 | 3순위 |
| reservations.js | 100 | 🟢 낮음 | 3순위 |
| categories.js | 95 | 🟢 낮음 | 4순위 |
| waiting.js | 90 | 🟢 낮음 | 4순위 |
| planRequests.js | 84 | 🟢 낮음 | 4순위 |
| products.js | 83 | 🟢 낮음 | 4순위 |
| staffRequests.js | 80 | 🟢 낮음 | 4순위 |

#### ✅ 이미 분리된 라우터 (기존)
orderController, settlementController, storeSettingsController, bulkSmsController, authController, crmController, exportController, inventoryController, menuOptimizationController, notificationsController, notificationTemplatesController, aiAssistantController, staffGamificationController

### 2.3 컨트롤러/서비스/리포지토리 상세

#### Controllers (17개)
| 파일 | 핸들러 수 | LOC |
|------|----------|-----|
| exportController.js | - | 552 |
| authController.js | - | 272 |
| orderController.js | - | 68 |
| inventoryController.js | - | 244 |
| notificationsController.js | - | 172 |
| notificationTemplatesController.js | - | 170 |
| storeController.js | 17 | 158 |
| staffGamificationController.js | - | 145 |
| paymentController.js | 14 | 144 |
| crmController.js | - | 131 |
| menuOptimizationController.js | - | 130 |
| customerController.js | 9 | 83 |
| staffController.js | 15 | 82 |
| bulkSmsController.js | - | 80 |
| orderController.js | - | 68 |
| settlementController.js | - | 57 |
| aiAssistantController.js | - | 56 |
| storeSettingsController.js | - | 44 |

#### Services (19개)
| 파일 | LOC | 핵심 책임 |
|------|-----|----------|
| PaymentService.js | 643 | 결제 처리, 승인, 취소, 분할결제 |
| aiService.js | 592 | Gemini AI 메뉴 추천, 분석 |
| CommunityService.js | 323 | 커뮤니티 CRUD, 좋아요 |
| notificationService.js | 273 | FCM 푸시 알림, SMS |
| StaffService.js | 271 | 직원 CRUD, 출퇴근, 스케줄 |
| StoreService.js | 258 | 매장 CRUD, 검색, 캐시 |
| OrderService.js | 244 | 주문 처리, 상태 머신 |
| PointService.js | 242 | 포인트 적립/사용 |
| CustomerService.js | 216 | 고객 관리, 전화번호 가입 |
| weeklyReportService.js | 159 | 주간 리포트 생성 |
| newsCollectorService.js | 138 | 뉴스 수집 |
| webhookDispatcher.js | 133 | 웹훅 전송 |
| naverLocalService.js | 75 | 네이버 플레이스 연동 |
| naverPlaceService.js | 71 | 네이버 장소 검색 |
| geocodeService.js | 66 | 주소→좌표 변환 |
| seoulDataService.js | 63 | 서울시 데이터 |
| LedgerService.js | 61 | 장부 관리 |
| CampaignService.js | 56 | 캠페인 관리 |
| printService.js | 31 | 영수증 인쇄 |

#### Repositories (19개)
| 파일 | LOC |
|------|-----|
| Order.js | 595 |
| Point.js | 256 |
| Payment.js | 187 |
| Board.js | 184 |
| Store.js | 180 |
| Product.js | 143 |
| Settlement.js | 129 |
| Chat.js | 126 |
| PlanRequest.js | 111 |
| StoreCustomer.js | 107 |
| StaffAccountRequest.js | 96 |
| Table.js | 89 |
| User.js | 80 |
| Coupon.js | 78 |
| StoreTier.js | 69 |
| Ledger.js | 68 |
| Category.js | 61 |
| Monitoring.js | 44 |
| Receipt.js | 28 |

---

## 3. 프론트엔드 아키텍처 분석

### 3.1 구조

| 디렉토리 | 파일 수 | LOC |
|----------|---------|-----|
| components/ | 101 | 30,129 |
| pages/ | 18 | 4,546 |
| api/ | 17 | 572 |
| utils/ | 11 | 590 |
| hooks/ | 9 | 671 |
| contexts/ | 3 | 367 |
| **합계** | **161** | **~37,000** |

### 3.2 대형 컴포넌트 (리팩토링 필요)

| 파일 | LOC | 상태 |
|------|-----|------|
| MenuManager.jsx | 1,482 | 🔴 분해 필요 |
| StoreSetupWizard.jsx | 1,374 | 🔴 분해 필요 |
| LandingPage.jsx | 1,262 | 🔴 분해 필요 |
| Menu.jsx (고객) | 1,231 | 🔴 분해 필요 |
| StaffManager.jsx | 1,096 | 🔴 분해 필요 |
| CommunityPage.jsx | 1,006 | 🔴 분해 필요 |
| TableManager.jsx | 955 | 🔴 분해 필요 |
| MenuDemo.jsx | 783 | 🟡 검토 필요 |
| AnalyticsDashboard.jsx | 721 | 🟡 검토 필요 |
| CustomerManager.jsx | 645 | 🟡 검토 필요 |
| StoreSearch.jsx | 591 | 🟡 검토 필요 |
| BulkMenuModal.jsx | 582 | 🟡 검토 필요 |
| MenuPage.jsx | 572 | 🟡 검토 필요 |
| CustomerPhoneSheet.jsx | 570 | 🟡 검토 필요 |
| MasterDashboard.jsx | 569 | 🟡 검토 필요 |
| MenuBuilder.jsx | 559 | 🟡 검토 필요 |
| InventoryManager.jsx | 535 | 🟡 검토 필요 |
| StoreForm.jsx | 512 | 🟡 검토 필요 |

**250줄 이상 컴포넌트**: 18개 (전체 101개 중 18%)

### 3.3 프론트엔드 기술 스택

- **React 19** + Vite 7 + Tailwind 4
- **상태관리**: React Query (TanStack Query) + Context API (3개)
- **라우팅**: React Router
- **API 호출**: Axios (api/client.js)
- **애니메이션**: Framer Motion
- **다국어**: i18next
- **PWA**: Service Worker + Firebase Messaging

---

## 4. 데이터베이스 분석

### 4.1 모델 현황 (51개)

**핵심 비즈니스 모델**:
- `stores`, `products`, `orders`, `order_items`, `payments`
- `ledger` (장부), `settlements` (정산)
- `staff`, `staff_attendance`, `staff_schedules`
- `store_customers`, `user_points`, `point_transactions`
- `coupons`, `user_coupons`, `campaign_settings`
- `posts`, `comments`, `community_posts`
- `reviews`, `review_likes`
- `tables`, `waiting_list`, `reservations`
- `notifications`, `notification_templates`
- `chat_rooms`, `chat_messages`
- `stock_history`, `option_templates`
- `api_keys`, `webhook_endpoints`, `webhook_deliveries`

### 4.2 잠재적 이슈

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| 인덱스 부족可能性 | 🟡 | Prisma 스키마에서 `@@index` 명시가 적음 — 쿼리 성능 영향 |
| N+1 쿼리 위험 | 🟡 | Repository 패턴 사용으로 일부 완화됨 |
| 스키마 마이그레이션 | 🟢 | `prisma migrate deploy` 방식 — 프로덕션 안전 |

---

## 5. 보안 분석

### 5.1 인증/인가

| 구성요소 | 상태 | 설명 |
|----------|------|------|
| JWT 인증 | ✅ | HttpOnly 쿠키 기반 |
| 비밀번호 해싱 | ✅ | bcryptjs |
| 전화번호 암호화 | ✅ | AES-256 (phoneEncryption.js) |
| 매장별 권한 | ✅ | getStoreRole + checkStorePermission |
| API 키 인증 | ✅ | apiKeyAuth.js (Open API용) |
| SSRF 가드 | ✅ | ssrfGuard.js |
| CORS 화이트리스트 | ✅ | 5개 프로덕션 도메인만 허용 |

### 5.2 보안 미들웨어

| 미들웨어 | LOC | 설명 |
|----------|-----|------|
| auth.js | - | JWT 검증 |
| authMiddleware.js | - | 대체 인증 미들웨어 |
| storeAuth.js | - | 매장별 접근 제어 |
| apiKeyAuth.js | - | API 키 인증 |
| rateLimiter.js | - | 5티어 속도 제한 |
| validator.js | - | 입력 검증 |
| validate.js | - | Joi 스키마 검증 |

### 5.3 보안 우려사항

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| Helmet CSP unsafe-inline | 🟡 | `'unsafe-inline'`, `'unsafe-eval'` 사용 — XSS 리스크 |
| Free tier 배포 | 🟢 | Render 무료 티어 — 성능 제한 |
| .env 파일 | ✅ | .env.example 제공, .env gitignore |

---

## 6. 에러 처리 분석

| 구성요소 | 상태 |
|----------|------|
| catchAsync 패턴 | ✅ 전역 적용 (245개 try-catch 블록) |
| AppError 클래스 | ✅ 커스텀 에러 |
| errorHandler.js | ✅ 글로벌 에러 핸들러 |
| responseFormatter.js | ✅ 표준 응답 포맷 |
| alerting.js | ✅ 알림 시스템 |
| circuitBreaker.js | ✅ 서킷 브레이커 |

---

## 7. 테스트 분석

### 7.1 테스트 파일 (31개)

| 카테고리 | 파일 수 | 설명 |
|----------|---------|------|
| E2E (Playwright) | 9 | 관리자/고객/주문/키친 시나리오 |
| 통합 테스트 | 3 | 결제, 알림 |
| 회귀 테스트 | 1 | 결제-주문 흐름 |
| 단위 테스트 | 8 | 모델, 서비스, 유틸 |
| 스크립트 테스트 | 6 | 시나리오, 로그인, 통합 |
| API 테스트 | 1 | 마케팅 시나리오 |

### 7.2 테스트 커버리지 이슈

| 이슈 | 심각도 | 설명 |
|------|--------|------|
| 컨트롤러 테스트 부족 | 🔴 | 17개 컨트롤러 중 테스트 파일 0개 |
| 서비스 테스트 불균형 | 🟡 | 19개 서비스 중 4개만 테스트 |
| 리포지토리 테스트 부족 | 🔴 | 19개 리포지토리 중 1개만 테스트 |
| E2E 의존도 높음 | 🟡 | E2E가 9개 — 유닛/인TEGRATION보다 느림 |

---

## 8. 인프라 분석

### 8.1 배포 구성

| 구성요소 | 플랫폼 | 상태 |
|----------|--------|------|
| 프론트엔드 | Vercel | ✅ |
| 백엔드 | Render (싱가포르) | ⚠️ 무료 티어 |
| 데이터베이스 | Supabase (PostgreSQL) | ✅ |
| 파일 저장소 | Render 디스크 | ⚠️ 무료 티어 제한 |

### 8.2 의존성

**핵심 의존성 (24개)**:
- Express 5.2, Prisma 5.22, Socket.io 4.8
- Firebase Admin, Gemini AI, Toss Payments
- Winston (로깅), Swagger (API 문서)
- node-cron, node-cache
- Helmet, CORS, express-rate-limit

**보안 관련 업데이트**:
- `protobufjs ^7.6.3` (보안 패치)
- `ws ^8.21.0` (보안 패치)
- `minimatch ^9.0.7` (보안 패치)

---

## 9. 주요 개선 권장사항

### 9.1 즉시 수행 (1순위)

| 항목 | 작업 | 예상 LOC 이동 |
|------|------|--------------|
| ai.js 분리 | aiController + AIService 분리 | ~200줄 |
| boards.js 분리 | boardsController + BoardService 분리 | ~200줄 |
| legal.js 분리 | legalController 분리 | ~200줄 |
| v1.js 분리 | v1Controller 분리 | ~130줄 |

### 9.2 단기 수행 (2순위)

| 항목 | 작업 |
|------|------|
| points.js 분리 | pointController 분리 |
| analytics.js 분리 | analyticsController 분리 |
| reviews.js 분리 | reviewsController 분리 |
| 프론트엔드 250+ 줄 컴포넌트 분해 | MenuManager, StoreSetupWizard 등 18개 |

### 9.3 중기 수행 (3순위)

| 항목 | 작업 |
|------|------|
| 테스트 커버리지 확대 | 컨트롤러/서비스 단위 테스트 |
| Prisma 인덱스 최적화 | 쿼리 성능 튜닝 |
| Helmet CSP 강화 | unsafe-inline/eval 제거 |
| 프론트엔드 코드 스플리팅 | React.lazy + Suspense |

### 9.4 장기 수행 (4순위)

| 항목 | 작업 |
|------|------|
| Render 무료→유료 전환 | 성능/안정성 확보 |
| CI/CD 자동화 | GitHub Actions |
| 모니터링 강화 | APM 도입 (Datadog/Sentry) |
| API 문서 자동화 | Swagger → OpenAPI 3.1 |

---

## 10. 결론

### 강점
- ✅ **4-레이어 아키텍처** 체계적으로 구축됨
- ✅ **보안** 다층 방어 (JWT, bcrypt, CORS, SSRF, rate limit)
- ✅ **에러 처리** 일관된 패턴 (catchAsync, AppError)
- ✅ **로깅** 구조화 (Winston + 알림)
- ✅ **Cron 작업** 자동화 (주간 리포트, 뉴스 수집)

### 약점
- 🔴 **라우터 분리 미완료** — 14개 라우터에 인라인 비즈니스 로직
- 🔴 **테스트 커버리지 부족** — 컨트롤러/리포지토리 테스트 0개
- 🟡 **프론트엔드 대형 컴포넌트** — 18개 컴포넌트가 250줄 이상
- 🟡 **CSP 보안** — unsafe-inline/eval 사용
- 🟡 **무료 티어 배포** — 성능/안정성 제한

### 전체 점수
- **백엔드 아키텍처**: 75/100 (4-레이어 구축됨, 분리 작업 진행 중)
- **보안**: 80/100 (다층 방어, CSP 개선 필요)
- **테스트**: 45/100 (E2E는 있으나 단위/인TEGRATION 부족)
- **프론트엔드**: 65/100 (기능은 있으나 컴포넌트 분해 필요)
- **인프라**: 60/100 (무료 티어 제한)
- **종합**: 65/100
