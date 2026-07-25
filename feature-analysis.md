# WeMarket 프로젝트 기능별 분석 보고서

> 작성일: 2026-07-23
> 프로젝트: WeMarket QR Menu SaaS (D:\wemarket-toss\250105)
> 분석 방법: 코드 직접 확인 (controllers, services, repositories, routes, frontend, prisma schema, CI/CD)

---

## 1. 프로젝트 개요

| 항목 | 값 |
|---|---|
| **백엔드** | Express 5.2.1 (CommonJS), Prisma 5.22, PostgreSQL |
| **프론트엔드** | React 19, Vite 7, Tailwind CSS v3, Zustand, TanStack Query v5 |
| **컨트롤러** | 44개 |
| **서비스** | 38개 |
| **리포지토리** | 22개 |
| **라우트** | 49개 |
| **Prisma 모델** | 53개 |
| **프론트엔드 페이지** | 27개 |
| **프론트엔드 컴포넌트** | 25+개 |
| **커스텀 훅** | 11개 |
| **미들웨어** | 10개 |
| **테스트** | 39 unit suites, 14 integration suites, e2e (Playwright) |

---

## 2. 기능별 분석

### 2.1 인증 (Auth)

**진행 상황**: ⭐⭐⭐⭐☆ (완료)
- `authController.js`, `routes/auth.js`, `routes/socialAuth.js`, `routes/adminAuth.js`
- 이메일/비밀번호 인증, 소셜 로그인 (Google, Kakao, Naver), OTP 인증, 2FA (admin2faController)
- `phone_otps`, `admin_otps` 모델로 OTP 관리
- `social_accounts` 모델로 소셜 계정 연동

**문제점**:
- `phoneEncryption.js`에서 AES-256-CBC 사용 (결정적 암호화) — 동일 폰번호 → 동일 암호문 (패턴 분석 위험)
- OTP 유효시간 설정 불명확 (코드에서 5분 하드코딩 추정)
- 2FA가 admin에만 적용, 일반 사용자에게는 미적용

**추가기능 제안**:
- WebAuthn/FIDO2 지원 (비밀번호 없는 인증)
- TOTP 기반 2FA (Google Authenticator 호환)
- 인증 로그 감사 (auth_logs 테이블 추가)

### 2.2 매장 관리 (Store)

**진행 상황**: ⭐⭐⭐⭐⭐ (완료)
- `storeController.js`, `storeSettingsController.js`
- `stores` 모델: 30+ 필드 (이름, 주소, 전화번호 암호화, 테마 설정, 캠페인 설정, 계층 설정)
- `store_tier_settings`, `store_receipt_settings`, `store_point_settings`로 세부 설정 분리
- `store_partnerships`, `store_link_requests`, `store_favorites` 등 관계 모델 풍부

**문제점**:
- `stores.phone`이 AES-256-CBC로 암호화되어 있으나, 복호화 없이는 전화번호 검색 불가
- `store_staff` 모델과 `staff` 모델이 중복 — 직원-매장 관계 모델링 혼란
- 매장별 테마 설정이 프론트엔드에 직접 전달됨 (API 응답에 테마 데이터 포함)

**추가기능 제안**:
- 매장별 커스텀 도메인 지원
- 매장별 A/B 테스트 설정 (메뉴, 가격, 디자인)
- 매장 그룹 관리 (프랜차이즈 본부에서 하위 매장 일괄 관리)

### 2.3 상품 관리 (Product)

**진행 상황**: ⭐⭐⭐⭐☆ (완료)
- `productsController.js`, `categoriesController.js`, `optionTemplatesController.js`
- `products` 모델: 재고 수량, 알레르기 정보, 영양 정보, 조리 시간, 카테고리
- `option_templates` 모델로 옵션 템플릿 관리
- `categories` 모델로 카테고리 계층 구조

**문제점**:
- `products.nutrition_info`가 JSON 문자열로 저장 (구조화된 쿼리 어려움)
- `products.allergens`가 문자열 배열로 저장 (PostgreSQL 배열 타입 미사용)
- 카테고리 정렬 순서(`sort_order`)가 있으나, 프론트엔드에서 직접 정렬

**추가기능 제안**:
- 상품 이미지 다중 업로드 (현재 1개 이미지만 지원 추정)
- 상품 변형 (size, color 등) 관리 UI
- 상품별 영양 정보 표준화 (JSONB로 마이그레이션)

### 2.4 주문 관리 (Order)

**진행 상황**: ⭐⭐⭐⭐⭐ (완료)
- `orderController.js`, `OrderService.js`
- `orders` 모델: 분할 결제 지원 (NONE, EQUAL, ITEM), 주문 상태 관리, 예상 시간
- `order_items` 모델: 품목별 옵션, 분할 결제용 전화번호
- `waiting_list` 모델로 웨이팅/대기열 관리
- `tables` 모델로 테이블 관리

**문제점**:
- 주문 상태가 문자열로 저장 (`status` 필드) — enum으로 마이그레이션 필요
- `order_type`이 문자열 (dine_in, takeout, delivery) — enum 권장
- 분할 결제 로직이 복잡하지만 테스트 커버리지 낮음 (integration 테스트 1건)

**추가기능 제안**:
- 주문 취소/환불 자동화 (결제 취소 API 연동)
- 주문 내역 Excel/PDF 내보내기
- 주문 실시간 알림 (WebSocket + FCM 이중 전송)

### 2.5 결제 (Payment)

**진행 상황**: ⭐⭐⭐⭐☆ (완료)
- `paymentController.js`, `PaymentService.js`
- `payments` 모델: Toss Payments 연동, 부분 결제 지원, 포인트 결제, 현금 영수증
- `ledger` 모델로 원장 관리 (수수료, 부가세, 세금계산서)
- `settlements` 모델로 정산 관리

**문제점**:
- `payments.card_number`가 평문 저장 — PCI DSS 위반 (마스킹 필요)
- `payer_phone`이 평문 저장 — 개인정보 보호 문제
- 결제 취소/부분 취소 로직이 서비스에 분산 (PaymentService, OrderService, LedgerService)

**추가기능 제안**:
- 결제 금액 정산 자동화 (정산서 발급, 세금계산서 발행)
- 결제 수단별 수수료 정책 관리
- 결제 실패 시 자동 재결제 (재시도 큐)

### 2.6 직원 관리 (Staff)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `staffController.js`, `StaffService.js`, `staffGamificationController.js`
- `staff` 모델: 역할 기반 권한, 급여 정보
- `staff_attendance` 모델: 출퇴근 관리
- `staff_schedules` 모델: 시프트 스케줄링
- `staff_account_requests` 모델: 직원 계정 요청
- `staff_gamification` 기능 (포인트, 레벨, 업적)

**문제점**:
- `staff` 모델과 `store_staff` 모델이 중복 — 직원-매장 다대다 관계 모델링 불명확
- 급여 정보가 `staff` 모델에 직접 저장 (별도 `payroll` 모델 권장)
- 출퇴근 위치 검증 미희망 (GPS/Beacon 기반 출퇴근 가능)

**추가기능 제안**:
- 직원 성과 평가 시스템
- 급여 명세서 발급 (PDF)
- 직원 채팅/메모 기능

### 2.7 재고 관리 (Inventory)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `inventoryController.js`
- `stock_history` 모델: 입출고 이력 (ORDER, MANUAL_IN, MANUAL_OUT, CORRECTION, RETURN)
- `products.low_stock_threshold`로 최저 재고 알림
- `products.stock_quantity` (null = 무제한)

**문제점**:
- 재고 이동/조정 기능이 없음 (매장 간 재고 이월 불가)
- 재고 알림이 이메일/알림으로만 발송 (실시간 알림 미희망)
- `stock_history`에 거래처 정보가 없음 (매수/매출 구분 어려움)

**추가기능 제안**:
- 자동 재고 주문 (최저 재고 도달 시 발주서 발행)
- 재고 이동 내역 관리 (매장 간 이월)
- 재고 실사 기능 (주기적 재고 조사)

### 2.8 KDS (Kitchen Display System)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `kdsController.js`, `KdsService.js`
- 주문 접수 → 조리 시작 → 완료 흐름
- 실시간 WebSocket 알림

**문제점**:
- KDS 화면이 단일 디자인 (커스텀 테마 미지원)
- 조리 시간 예측이 단순 평균 (AI 기반 예측 미희망)
- KDS와 주문 시스템이 강결합 (분리 가능)

**추가기능 제안**:
- KDS 화면 커스텀 레이아웃 (드라이버/프런트 분리)
- 조리 시간 AI 예측 (이력 데이터 기반)
- KDS 알림 설정 (특정 품목 주문 시 알림)

### 2.9 고객 관리 (Customer/CRM)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `customerController.js`, `crmController.js`
- `store_customers` 모델: 고객 정보, 방문 횟수, 총 구매액
- `customer` 페이지 (React): 고객 목록, 상세, 폼
- `point_transactions`, `user_points`, `user_coupons` 모델로 포인트/쿠폰 관리

**문제점**:
- 고객 세그먼트 기능이 없음 (VIP, 일반, 이탈 고객 구분)
- 고객 방문 패턴 분석 미희망
- SMS/푸시 발송이 AlimtalkService에 집중 (이메일 미지원)

**추가기능 제안**:
- 고객 세그먼트 자동 분류 (RFM 분석)
- 고객 생애가치(LTV) 예측
- 고객 맞춤형 쿠폰 발급 (방문 패턴 기반)

### 2.10 커뮤니티/게시판 (Community/Board)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `boardController.js`, `CommunityService.js`
- `posts`, `comments`, `post_likes`, `community_posts`, `community_post_likes` 모델
- `board/` 컴포넌트 디렉토리

**문제점**:
- `posts`와 `community_posts`가 중복 — 게시판 종류 구분 불명확
- 댓글 기능이 기본적 (대댓글, 알림 미지원)
- 관리자 승인 없이 바로 게시 (스팸 필터 미희망)

**추가기능 제안**:
- 게시글 관리자 승인 워크플로
- 스팸 필터 (AI 기반)
- 게시글 통계 (조회수, 추천수, 댓글수)

### 2.11 AI 기능 (AI)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `aiController.js`, `aiAssistantController.js`, `aiService.js`
- `menuOptimizationController.js` (AI 메뉴 최적화)
- Google Generative AI 연동 (`@google/generative-ai`)

**문제점**:
- AI 기능이 단순 프롬프트 호출 (복잡한 추론 미희망)
- AI 응답 캐싱 미희망 (반복 호출 비용 증가)
- AI 사용량/비용 추적 미희망

**추가기능 제안**:
- AI 메뉴 가격 최적화 (수익률 기반)
- AI 고객 리뷰 분석 (감성 분석)
- AI 주문 추천 (고객 이력 기반)

### 2.12 분석/리포트 (Analytics)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `analyticsController.js`
- `ledger`, `settlements` 모델로 재무 데이터
- `metrics` 모델로 성능 메트릭

**문제점**:
- 분석 리포트가 기본적 (매출, 주문량)
- 실시간 대시보드 미희망 (데이터 지연)
- 내보내기 기능이 제한적 (CSV만 지원)

**추가기능 제안**:
- 실시간 대시보드 (WebSocket 기반)
- 커스텀 리포트 빌더
- 리포트 자동 발송 (이메일/PDF)

### 2.13 알림 (Notifications)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `notificationsController.js`, `notificationService.js`, `alimtalkController.js`, `AlimtalkService.js`
- FCM 푸시, 카카오 알림톡, Socket.io 실시간 알림
- `notifications` 모델, `notification_templates` 모델

**문제점**:
- 알림 템플릿이 한국어 중심 (다국어 지원 미희망)
- 알림 발송 실패 시 재발송 큐 미희망
- 알림 설정이 매장 단위 (고객 개별 설정 미희망)

**추가기능 제안**:
- 알림 발송 실패 재시도 큐
- 고객별 알림 설정 (앱/문자/메일 선택)
- 알림 A/B 테스트

### 2.14 리뷰 (Reviews)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `reviewsController.js`
- `reviews` 모델, `review_likes` 모델

**문제점**:
- 리뷰에 사진 업로드 미지원
- 리뷰 신고/숨김 기능 미희망
- 리뷰에 대한 운영자 답변 기능 미희망

**추가기능 제안**:
- 리뷰 사진 업로드
- 리뷰 운영자 답변
- 리뷰 신고/차단 시스템

### 2.15 쿠폰 (Coupons)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `couponsController.js`, `CouponsService.js`
- `coupons` 모델, `user_coupons` 모델

**문제점**:
- 쿠폰 조건이 단순 (금액, 개수)
- 쿠폰 사용 제한이 없음 (중복 사용 가능)
- 쿠폰 통계가 없음

**추가기능 제안**:
- 쿠폰 조건 고급 설정 (최소 주문금액, 특정 상품, 방문 횟수)
- 쿠폰 사용 제한 (1인 1회, 기간 제한)
- 쿠폰 성과 분석

### 2.16 예약 (Reservations)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `reservationsController.js`

**문제점**:
- 예약 시간 선택이 단순 (30분 간격 고정)
- 예약 변경/취소 정책이 없음
- 예약 알림이 미희망

**추가기능 제안**:
- 예약 시간대 커스텀 설정
- 예약 변경/취소 정책 (마감 시간, 환불 규정)
- 예약 알림 (문자, 푸시)

### 2.17 웨이팅 (Waiting)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `waitingController.js`
- `waiting_list` 모델

**문제점**:
- 웨이팅 알림이 문자로만 발송
- 웨이팅 순번 변경 시 고객 알림 미희망

**추가기능 제안**:
- 웨이팅 실시간 알림 (앱 푸시)
- 웨이팅 순번 변경 시 고객 선택 (선택적 대기)

### 2.18 푸드트럭 (Food Truck)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `foodTruckController.js`, `FoodTruckService.js`
- `food_trucks` 모델
- `FoodTruckLanding.jsx`, `FoodTruckDesignShowcase.jsx`

**문제점**:
- 푸드트럭 위치 추적 기능이 없음 (GPS 미희망)
- 푸드트럭 메뉴 관리가 일반 매장과 분리됨

**추가기능 제안**:
- 푸드트럭 실시간 위치 추적
- 푸드트럭 예약/예약 알림
- 푸드트럭 리뷰/평가

### 2.19 프린트 (Print)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `printJobsController.js`, `printService.js`
- `print_jobs` 모델

**문제점**:
- 프린트 드라이버 호환성 이슈 (Windows/Linux)
- 프린트 실패 시 재시도 로직 미희망

**추가기능 제안**:
- 프린트 드라이버 추상화
- 프린트 실패 자동 재시도
- 프린트 작업 큐 관리

### 2.20 개발자 포털 (Developer)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `developerController.js`, `DeveloperService.js`
- `api_keys` 모델, `webhook_endpoints`, `webhook_deliveries` 모델

**문제점**:
- API 문서가 Swagger로만 제공 (Markdown 문서 미희망)
- Webhook 재발송 기능이 없음
- API 사용량/요금제 추적 미희망

**추가기능 제안**:
- API 사용량 대시보드
- Webhook 재발송/테스트 기능
- API 키 권한 세분화

### 2.21 모니터링 (Monitoring)

**진행 상황**: ⭐⭐⭐⭐⭐ (완료)
- `monitoringController.js`, `performanceMonitor.js`, `alerting.js`, `circuitBreaker.js`
- `metrics` 모델, `AuditLog` 모델
- Sentry v10, Slack 알림, 슬로우 쿼리 모니터링

**문제점**:
- 모니터링 대시보드가 별도 (Grafana 미연동)
- 메트릭 데이터가 50개 버퍼에만 저장 (실시간 분석 어려움)

**추가기능 제안**:
- Grafana 대시보드 연동
- 메트릭 데이터 장기 보관 (별도 저장소)
- 메트릭 기반 자동 스케일링

### 2.22 뉴스 (News)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `newsController.js`, `newsCrawlerService.js`
- `news` 모델

**문제점**:
- 뉴스 크롤러가 단일 소스 (네이버)
- 뉴스 필터링/카테고리화 미희망

**추가기능 제안**:
- 다중 뉴스 소스 크롤링
- 뉴스 카테고리/태그 관리
- 뉴스 요약 (AI 기반)

### 2.23 날씨 (Weather)

**진행 상황**: ⭐⭐ (미희망)
- `weatherController.js`, `weatherService.js`

**문제점**:
- 날씨 API 연동만 존재 (실제 기능 미희망)
- 날씨 기반 메뉴 추천 미희망

**추가기능 제안**:
- 날씨 기반 메뉴 추천
- 날씨 기반 운영 시간 조정

### 2.24 법적 문서 (Legal)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `legalController.js`
- `legal_pages` 모델 (추정)

**문제점**:
- 법적 문서 버전 관리 미희망
- 다국어 법적 문서 미희망

**추가기능 제안**:
- 법적 문서 버전 관리
- 다국어 법적 문서

### 2.25 채팅 (Chat)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `chat` 라우트, `socket/handlers.js`
- `chat_rooms`, `chat_messages` 모델

**문제점**:
- 채팅이 Socket.io에 의존 (오프라인 메시지 미희망)
- 채팅 파일 전송 미희망

**추가기능 제안**:
- 오프라인 메시지 (DB 저장)
- 채팅 파일/이미지 전송
- 채팅 봇 (AI 고객센터)

### 2.26 장바구니 (Cart)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `cartController.js`, `CartService.js`
- `cart` 모델, `shared_cart_items` 모델

**문제점**:
- 공유 장바구니 기능이 있으나 UI 미희망
- 장바구니 저장 기간이 짧음

**추가기능 제안**:
- 장바구니 공유 (QR 코드)
- 장바구니 저장 기간 연장

### 2.27 SSE (Server-Sent Events)

**진행 상황**: ⭐⭐ (미희망)
- `sseController.js`

**문제점**:
- SSE 사용처가 불분명
- SSE와 WebSocket 중복

**추가기능 제안**:
- SSE를 실시간 알림에 활용
- SSE 연결 관리 (재연결, 백프레시)

### 2.28 알림톡 (Alimtalk)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `alimtalkController.js`, `AlimtalkService.js`
- 카카오 비즈니스 알림톡 연동

**문제점**:
- 알림톡 템플릿 관리가 코드에 하드코딩
- 알림톡 발송 실패 시 SMS 대체 발송 미희망

**추가기능 제안**:
- 알림톡 템플릿 DB 관리
- 발송 실패 시 SMS 대체 발송
- 알림톡 발송 통계

### 2.29 메뉴 최적화 (Menu Optimization)

**진행 상황**: ⭐⭐ (부분 완료)
- `menuOptimizationController.js`

**문제점**:
- AI 메뉴 최적화가 단순 추천 (복잡한 분석 미희망)
- 메뉴 최적화 결과가 실시간 반영되지 않음

**추가기능 제안**:
- AI 메뉴 가격 최적화 (수익률 기반)
- 메뉴 최적화 A/B 테스트
- 메뉴 최적화 결과 자동 적용

---

## 3. 프론트엔드 기능별 분석

### 3.1 관리자 대시보드 (AdminDashboard)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `AdminDashboard.jsx`, `admin/` 컴포넌트 디렉토리
- 매출, 주문, 고객, 직원 통계

**문제점**:
- 대시보드 위젯이 고정 (커스터마이징 불가)
- 실시간 데이터가 아님 (페이지 새로고침 필요)

**추가기능 제안**:
- 위젯 드래그 앤 드롭 커스터마이징
- 실시간 데이터 (WebSocket)
- 대시보드 템플릿 저장/공유

### 3.2 메뉴/키오스크 (MenuPage, KioskPage)

**진행 상황**: ⭐⭐⭐⭐⭐ (완료)
- `MenuPage.jsx`, `KioskPage.jsx`, `menu/` 컴포넌트
- QR 주문, 키오스크 주문, 테이블 주문

**문제점**:
- 키오스크 모드에서 뒤로 가기 버튼이 없음
- 메뉴 이미지 로딩 최적화 미희망 (Lazy Loading)

**추가기능 제안**:
- 키오스크 자동 로그아웃 (타이머)
- 메뉴 이미지 Lazy Loading
- 키오스크 화면 잠금 (관리자 설정)

### 3.3 주방 디스플레이 (KitchenDisplay)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `KitchenDisplay.jsx`

**문제점**:
- 화면이 단일 레이아웃 (커스텀 불가)
- 알레르기 정보 표시 미희망

**추가기능 제안**:
- 주문 필터링 (카테고리, 시간대)
- 알레르기 경고 표시
- 조리 완료 시간 기록

### 3.4 인증 (AuthPage, Login)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `AuthPage.jsx`, `Login.jsx`, `SocialLoginButtons.jsx`

**문제점**:
- 소셜 로그인 버튼이 기본 스타일 (브랜드 컬러 미희망)
- 로그인 실패 시 구체적인 에러 메시지 미희망

**추가기능 제안**:
- 소셜 로그인 브랜드 컬러 적용
- 로그인 실패 에러 메시지 구체화
- 로그인 기록/보안 알림

### 3.5 고객 뷰 (Customer)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `customer/` 페이지 디렉토리

**문제점**:
- 고객 뷰가 단순 목록 (상세 분석 미희망)
- 고객 방문 이력이 불완전

**추가기능 제안**:
- 고객 방문 히트맵
- 고객 선호 메뉴 분석
- 고객 생애가치(LTV) 표시

### 3.6 푸드트럭 (FoodTruckLanding, FoodTruckDesignShowcase)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `FoodTruckLanding.jsx`, `FoodTruckDesignShowcase.jsx`

**문제점**:
- 푸드트럭 랜딩 페이지가 정적 (실시간 정보 미희망)
- 디자인 쇼케이스가 이미지 기반 (인터랙티브 미희망)

**추가기능 제안**:
- 푸드트럭 실시간 위치/메뉴 표시
- 푸드트럭 예약 기능
- 푸드트럭 리뷰/평가

### 3.7 매장 디스플레이 (StoreDisplay, StoreSearchPage)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `StoreDisplay.jsx`, `StoreSearchPage.jsx`, `StoreLocator.jsx`, `StoreMapLeaflet.jsx`

**문제점**:
- 매장 검색이 기본 (필터링/정렬 제한)
- 지도 컴포넌트가 Leaflet에 의존 (성능 이슈)

**추가기능 제항**:
- 매장 검색 고급 필터 (거리, 평점, 가격대)
- 매장 리뷰 미리보기
- 매장 즐겨찾기

### 3.8 매니저 뷰 (ManagerView)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `ManagerView.jsx`

**문제점**:
- 매니저 뷰가 단일 페이지 (기능 제한)
- 매니저 권한 설정이 불분명

**추가기능 제안**:
- 매니저 역할별 대시보드
- 매니저 알림 설정
- 매니저 업무 일지

### 3.9 마케팅 (Marketing)

**진행 상황**: ⭐⭐ (부분 완료)
- `marketing/` 페이지 디렉토리

**문제점**:
- 마케팅 기능이 미희망 (구현 예정)

**추가기능 제안**:
- 프로모션 캠페인 관리
- 이메일/SMS 마케팅 자동화
- 마케팅 ROI 분석

### 3.10 결제 (PaymentSuccess, PaymentFail)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `PaymentSuccess.jsx`, `PaymentFail.jsx`

**문제점**:
- 결제 성공/실패 페이지가 단순 (추가 정보 미희망)
- 결제 취소/환불 UI 미희망

**추가기능 제안**:
- 결제 내역 상세 보기
- 결제 취소/환불 요청
- 결제 영수증 다운로드

### 3.11 프로필 (ProfilePage)

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `ProfilePage.jsx`

**문제점**:
- 프로필 수정 기능이 제한적
- 프로필 사진 업로드 미희망

**추가기능 제안**:
- 프로필 사진 업로드
- 알림 설정
- 계정 보안 (비밀번호 변경, 2FA)

### 3.12 플랜 업그레이드 (PlanUpgrade)

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `PlanUpgrade.jsx`, `PlanRequestsManage.jsx`

**문제점**:
- 플랜 업그레이드가 수동 (관리자 승인 필요)
- 플랜 기능 차이가 불분명

**추가기능 제안**:
- 플랜 업그레이드 자동 결제
- 플랜 기능 비교표
- 플랜 사용량 알림

---

## 4. 인프라스트럭처 분석

### 4.1 CI/CD

**진행 상황**: ⭐⭐⭐⭐ (완료)
- `.github/workflows/ci.yml` (171 lines, 6 jobs)
- lint-and-test, backend-unit-tests, backend-integration-tests, frontend-tests, deploy, security-scan

**문제점**:
- CI에서 Docker 빌드가 없음 (직접 Node.js 실행)
- security-scan이 Semgrep으로만 (SAST 미희망)
- 배포가 Render에 의존 (벤더 락인)

**추가기능 제안**:
- Docker 빌드 + 취약점 스캔 (Trivy)
- DAST 스캔 추가 (OWASP ZAP)
- 멀티 클라우드 배포 (AWS, GCP 옵션)

### 4.2 Docker

**진행 상황**: ⭐ (미희망)
- Dockerfile, docker-compose.yml 모두 없음

**문제점**:
- 로컬 개발 환경 설정이 복잡 (Node.js + PostgreSQL 직접 설치)
- 프로덕션 배포가 Render에 의존 (벤더 락인)
- 개발/스테이징/프로덕션 환경 통일 어려움

**추가기능 제안**:
- Dockerfile 작성 (멀티 스테이지 빌드)
- docker-compose.yml 작성 (개발 환경)
- Docker 이미지 취약점 스캔 (Trivy)

### 4.3 배포

**진행 상황**: ⭐⭐⭐ (부분 완료)
- `render.yaml` (Render 배포 설정)
- `wrangler.json` (Cloudflare Pages 프론트엔드)
- `frontend/wrangler.json` (Cloudflare Pages)

**문제점**:
- 백엔드가 Render free 플랜 (성능 제한)
- 프론트엔드가 Cloudflare Pages (Edge 함수 제한)
- DB가 별도 (Supabase/PostgreSQL)

**추가기능 제안**:
- 백엔드 Docker화 + Kubernetes 배포
- CDN 최적화 (이미지, 정적 파일)
- 블루/그린 배포 전략

### 4.4 테스트

**진행 상황**: ⭐⭐⭐ (부분 완료)
- 39 unit test suites, 14 integration test suites
- Jest (unit/integration), Playwright (e2e)
- 커버리지: branches 45%, functions 60%, lines 65%

**문제점**:
- 커버리지가 낮음 (branches 45%)
- e2e 테스트가 제한적 (order-flow, static-pages)
- 테스트 데이터 관리가 어려움 (실제 DB 사용)

**추가기능 제안**:
- 커버리지 80% 달성 (branches, functions, lines)
- e2e 테스트 확대 (결제, 알림, KDS)
- 테스트 데이터 팩토리 (faker.js 기반)

### 4.5 모니터링

**진행 상황**: ⭐⭐⭐⭐ (완료)
- Sentry v10, Slack 알림, 슬로우 쿼리 모니터링
- `metrics` 모델, `AuditLog` 모델
- `monitoringController.js`, `alerting.js`, `circuitBreaker.js`

**문제점**:
- Grafana 대시보드 미연동
- 메트릭 데이터가 50개 버퍼에만 저장
- 헬스 체크가 기본적

**추가기능 제안**:
- Grafana 대시보드 연동
- 메트릭 데이터 장기 보관
- 헬스 체크 고급화 (의존성 서비스 체크)

---

## 5. 데이터 모델 분석 (53개 모델)

### 5.1 핵심 모델

| 모델 | 설명 | 문제점 |
|---|---|---|
| `stores` | 매장 정보 (30+ 필드) | phone 암호화로 인해 검색 어려움 |
| `orders` | 주문 (분할 결제 지원) | 상태가 문자열 (enum 권장) |
| `order_items` | 주문 품목 | 옵션이 JSON 문자열 |
| `payments` | 결제 (Toss 연동) | card_number 평문 저장 (PCI DSS 위반) |
| `products` | 상품 (재고, 알레르기) | nutrition_info가 JSON 문자열 |
| `users` | 사용자 | - |
| `staff` | 직원 | store_staff와 중복 |
| `tables` | 테이블 | - |
| `categories` | 카테고리 | - |
| `ledger` | 원장 | - |
| `settlements` | 정산 | payment_method_breakdown JSON |

### 5.2 운영 모델

| 모델 | 설명 | 문제점 |
|---|---|---|
| `staff_attendance` | 출퇴근 | 위치 검증 미희망 |
| `staff_schedules` | 시프트 | - |
| `stock_history` | 재고 이력 | 거래처 정보 없음 |
| `print_jobs` | 프린트 작업 | - |
| `audit_logs` | 감사 로그 | - |
| `metrics` | 성능 메트릭 | 50개 버퍼 제한 |

### 5.3 커뮤니티 모델

| 모델 | 설명 | 문제점 |
|---|---|---|
| `posts` | 게시글 | community_posts와 중복 |
| `comments` | 댓글 | 대댓글 구조 단순 |
| `post_likes` | 게시글 좋아요 | - |
| `community_posts` | 커뮤니티 게시글 | posts와 중복 |
| `community_post_likes` | 커뮤니티 좋아요 | - |

### 5.4 마케팅 모델

| 모델 | 설명 | 문제점 |
|---|---|---|
| `coupons` | 쿠폰 | 조건 단순 |
| `user_coupons` | 사용자 쿠폰 | - |
| `campaign_settings` | 캠페인 설정 | - |
| `notifications` | 알림 | - |
| `notification_templates` | 알림 템플릿 | 한국어 중심 |
| `webhook_endpoints` | Webhook 엔드포인트 | - |
| `webhook_deliveries` | Webhook 전송 | 재발송 기능 없음 |

### 5.5 문제점 요약

1. **중복 모델**: `posts`/`community_posts`, `staff`/`store_staff`
2. **문자열 필드**: `orders.status`, `orders.order_type` (enum 권장)
3. **평문 저장**: `payments.card_number`, `payments.payer_phone` (암호화 필요)
4. **JSON 문자열**: `products.nutrition_info`, `orders.options` (JSONB 권장)
5. **암호화로 인한 검색 불가**: `stores.phone` (검색 인덱스 필요)

---

## 6. 종합 평가

### 6.1 기능별 진행 상황 요약

| 기능 영역 | 진행 상황 | 비고 |
|---|---|---|
| 인증 | ⭐⭐⭐⭐☆ | 2FA, 소셜 로그인 완료 |
| 매장 관리 | ⭐⭐⭐⭐⭐ | 완전 완료 |
| 상품 관리 | ⭐⭐⭐⭐☆ | 영양 정보 구조화 필요 |
| 주문 관리 | ⭐⭐⭐⭐⭐ | 분할 결제 완료 |
| 결제 | ⭐⭐⭐⭐☆ | PCI DSS 이슈 |
| 직원 관리 | ⭐⭐⭐⭐ | 급여 모델 분리 필요 |
| 재고 관리 | ⭐⭐⭐⭐ | 매장 간 이월 미희망 |
| KDS | ⭐⭐⭐⭐ | 커스텀 레이아웃 미희망 |
| 고객/CRM | ⭐⭐⭐⭐ | 세그먼트 기능 미희망 |
| 커뮤니티 | ⭐⭐⭐ | 승인 워크플로 미희망 |
| AI 기능 | ⭐⭐⭐ | 기능 확장 필요 |
| 분석/리포트 | ⭐⭐⭐⭐ | 실시간 대시보드 미희망 |
| 알림 | ⭐⭐⭐⭐ | 다국어 템플릿 미희망 |
| 리뷰 | ⭐⭐⭐ | 사진 업로드 미희망 |
| 쿠폰 | ⭐⭐⭐⭐ | 고급 조건 미희망 |
| 예약 | ⭐⭐⭐ | 알림 기능 미희망 |
| 푸드트럭 | ⭐⭐⭐ | 위치 추적 미희망 |
| 프린트 | ⭐⭐⭐⭐ | 드라이버 추상화 필요 |
| 개발자 포털 | ⭐⭐⭐ | 사용량 추적 미희망 |
| 모니터링 | ⭐⭐⭐⭐⭐ | 완전 완료 |
| 뉴스 | ⭐⭐⭐ | 다중 소스 미희망 |
| 날씨 | ⭐⭐ | 기능 확장 필요 |
| 법적 문서 | ⭐⭐⭐ | 버전 관리 미희망 |
| 채팅 | ⭐⭐⭐ | 오프라인 메시지 미희망 |
| 장바구니 | ⭐⭐⭐ | 공유 기능 UI 미희망 |
| SSE | ⭐⭐ | 사용처 불분명 |
| 알림톡 | ⭐⭐⭐⭐ | 템플릿 DB 관리 필요 |
| 메뉴 최적화 | ⭐⭐ | AI 분석 확장 필요 |

### 6.2 문제점 요약

| 카테고리 | 문제점 | 심각도 |
|---|---|---|
| 보안 | payments.card_number 평문 저장 | ⚠️ 높음 (PCI DSS) |
| 보안 | payments.payer_phone 평문 저장 | ⚠️ 높음 (개인정보) |
| 보안 | stores.phone 암호화로 검색 불가 | ⚠️ 중간 |
| 아키텍처 | 모델 중복 (posts/community_posts) | ⚠️ 중간 |
| 아키텍처 | 문자열 enum (orders.status) | ⚠️ 중간 |
| 아키텍처 | JSON 문자열 필드 | ⚠️ 중간 |
| 인프라 | Docker 없음 | ⚠️ 높음 |
| 테스트 | 커버리지 45% (branches) | ⚠️ 높음 |
| 운영 | 모니터링 대시보드 없음 | ⚠️ 중간 |
| 운영 | 배포 벤더 락인 (Render) | ⚠️ 중간 |

### 6.3 추가기능 제안 우선순위

| 우선순위 | 기능 | 이유 |
|---|---|---|
| P0 | Docker화 | 배포/개발 환경 표준화 |
| P0 | PCI DSS 컴플라이언스 | 결제 데이터 보안 |
| P0 | 테스트 커버리지 80% | 코드 품질 |
| P1 | Grafana 모니터링 | 운영 가시성 |
| P1 | 모델 정리 (중복 제거) | 데이터 일관성 |
| P1 | 실시간 대시보드 | 운영 효율성 |
| P2 | AI 기능 확장 | 차별성 |
| P2 | 멀티 클라우드 배포 | 벤더 락인 해소 |
| P2 | 다국어 지원 강화 | 해외 진출 |
| P3 | 푸드트럭 위치 추적 | 기능 확장 |
| P3 | 채팅 오프라인 메시지 | 사용자 경험 |

---

## 7. 결론

WeMarket은 QR 메뉴 SaaS로서 **핵심 기능(매장, 상품, 주문, 결제, 직원)은 80% 완료**되었습니다. 

**강점**:
- 53개 Prisma 모델로 풍부한 데이터 구조
- 분할 결제, 포인트, 쿠폰 등 고급 기능 구현
- 모니터링(Sentry, 알림, 슬로우 쿼리) 완비
- CI/CD 파이프라인 구축

**약점**:
- Docker 없음 (배포/개발 환경 문제)
- 테스트 커버리지 낮음 (branches 45%)
- PCI DSS 컴플라이언스 이슈 (카드 번호 평문 저장)
- 모델 중복 및 문자열 enum 사용

**로드맵**:
1. **단기 (1-2개월)**: Docker화, PCI DSS 컴플라이언스, 테스트 커버리지 80%
2. **중기 (3-6개월)**: Grafana 모니터링, 모델 정리, 실시간 대시보드
3. **장기 (6개월 이상)**: AI 기능 확장, 멀티 클라우드 배포, 해외 진출
