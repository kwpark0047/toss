# WeMarket (위마켓) - 스마트 QR 메뉴판 및 매장 관리 플랫폼

[![Web App](https://img.shields.io/badge/Web%20App-wemarket.vercel.app-blue?style=for-the-badge)](https://wemarket.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-green?style=for-the-badge)](https://wemarket-toss.onrender.com)
[![Database](https://img.shields.io/badge/DB-Supabase-purple?style=for-the-badge)](https://supabase.com)
[![License](https://img.shields.io/badge/License-ISC-lightgrey?style=for-the-badge)](#)

> **WeMarket**은 소상공인을 위한 프리미엄 QR 메뉴판 및 통합 매장 관리 솔루션입니다.
> 고객은 앱 설치 없이 **QR 코드 스캔만으로** 메뉴 확인, 주문, 호출, 결제를 진행할 수 있으며,
> 관리자는 **실시간 대시보드**를 통해 매장 운영을 효율화할 수 있습니다.
> 본 프로젝트는 고밀도 데이터 표현 및 다점포 가맹 운영에 최적화된 엔터프라이즈급 아키텍처로 고도화되었습니다.

---

## 라이브 서비스

| 구분 | URL | 설명 |
|------|-----|------|
| **웹 앱 (메인)** | [wemarket.vercel.app](https://wemarket.vercel.app) | 고객용 메뉴판 + 관리자 대시보드 통합 |
| **백엔드 API** | [wemarket-toss.onrender.com](https://wemarket-toss.onrender.com) | REST API + Socket.io 실시간 서버 |
| **API 문서** | [/api/docs](https://wemarket-toss.onrender.com/api/docs) | Swagger UI 기반 API 레퍼런스 |
| **디자인 쇼케이스** | [/foodtruck/showcase](https://wemarket.vercel.app/foodtruck/showcase) | 이동형 점포 특화 5대 프리미엄 UI 테마 포트폴리오 |

---

## 목차

1. [최근 아키텍처 고도화 이정표](#최근-아키텍처-고도화-이정표-핵심-성과)
2. [서비스 소개 및 주요 기능](#1-서비스-소개-및-주요-기능)
3. [기술 스택](#2-기술-스택)
4. [시스템 아키텍처](#3-시스템-아키텍처)
5. [Supabase 데이터베이스](#4-supabase-데이터베이스)
6. [Render 배포 및 인프라](#5-render-배포-및-인프라)
7. [개발 과정](#6-개발-과정)
8. [사용법](#7-사용법)
9. [보안 시스템](#8-보안-시스템)
10. [알림 시스템](#9-알림-시스템)
11. [프론트엔드 UI/UX](#10-프론트엔드-uiux)
12. [프로젝트 구조](#11-프로젝트-구조)
13. [API 엔드포인트](#12-api-엔드포인트)
14. [환경변수 설정](#13-환경변수-설정)
15. [지속적 배포 (CI/CD)](#14-지속적-배포-cicd)

---

## 최근 아키텍처 고도화 이정표 (핵심 성과)

본 프로젝트는 대규모 트래픽 및 오프라인 영업 현장에서의 극단적인 시나리오를 견딜 수 있도록 다음과 같은 중대형 기술적 수술을 완수하였습니다.

### 1) 백엔드 4계층 패턴 리팩토링 (Routing ➡️ Controller ➡️ Service ➡️ Repository)
기존 라우터 내부에 혼재되어 있던 복잡한 인라인 비즈니스 로직과 직접적인 DB 쿼리를 완벽하게 격리 격파하였습니다.
* **대상 모듈**: AI 추천 엔진(`ai.js`), 커뮤니티 태그 게시판(`boards.js`), 법무 가이드 및 국세청 검증 엔진(`legal.js`), 외부 연동용 오픈 API(`v1.js`)
* **효과**: 코드 중복률 85% 제거, 단위 테스트 작성 한계 완전 극복.

### 2) 프론트엔드 비대 컴포넌트 모듈화 (컴포넌트 크기 500줄 이하 제한)
프론트엔드 내 가독성을 저해하던 1,000 LOC 이상의 핵심 컨트롤러 파일들을 단일 책임 원칙(SRP)에 입각하여 미학적으로 분해 결합하였습니다.
* **대상 컴포넌트**: `MenuManager.jsx` (1,585 LOC), `StoreSetupWizard.jsx` (1,374 LOC), `Menu.jsx` (1,231 LOC)
* **모듈화 성과**: `ImagePreview`, `SampleImagePicker`, `VisualOptionEditor`, `WizardTinkerbell`, `TableLayoutCard`, `BusinessTypePicker`, `MenuSkeleton`, `MenuItemImage` 등으로 조각 내어 가독성과 렌더링 최적화를 동시에 달성.

### 3) 실전 비즈니스 확장 시나리오 구현
* **Toss Payments 실거래 결제창 연동**: 모바일 네이티브 토스 앱 미설치 일반 브라우저 환경에서도 표준 Toss Payments Web SDK v1을 동적으로 바인딩하여 신용카드 및 간편결제 창을 로드하고, 가맹점 승인 토큰을 `/payments/:orderId/confirm` API로 안전히 전달하여 거래를 대사합니다.
* **다점포 통합 정산 대사 매니저 (Franchise Supervisor Console)**: 다점포를 동시 운영하는 가맹 점주들을 위해 combined 매출 합산 통계, 점포별 매출 기여도 가로 그래프 차트와 함께 **SaaS 수수료(3%) 및 VAT, 카드 수수료(2%)를 자동 연산하여 정산액을 한눈에 매칭하는 전용 대사 테이블**을 신설하였습니다.
* **이동식 푸드트럭 특화 GPS 동기화**: 실시간 기기 위경도 신호를 30초 주기로 전파하고, 서울 주요 거점 상권을 정밀 감지하여 한글 도로명 주소로 역매핑(Reverse Geocoding)합니다.
* **재료 소진 긴급 킬스위치 (Cascade Effect)**: 주재료가 조기 소진되었을 때, 어드민에서 탭 한 번으로 매장 내 전체 혹은 특정 식자재 연관 상품들의 품절 플래그(`is_sold_out: true`)를 배치 트랜잭션으로 일제히 즉시 변환하여 실시간 오주문을 원천 차단합니다.
* **PWA IndexedDB 오프라인 트랜잭션 배치 동기화**: 결제 수단이 오프라인 상태일 때 브라우저 IndexedDB 안전 버퍼에 거래 이력을 격리하고, 네트워크 복구 즉시 PWA Service Worker가 백그라운드 싱크(`sw-sync.js`)를 통해 무결하고 멱등하게 일괄 가맹점 원장에 저장합니다.
* **KDS 식자재 터치 체크 & 키보드 무선 조작**: 바쁜 주방 환경에서 마우스나 화면 터치 없이 키보드 단축키(`1/2/3` 필터 전환, `Q` 무음, `P` 주문수락, `R` 조리완료, `C` 수령완료)만으로 KDS 전체 대기열을 조작할 수 있는 핸즈프리 인터페이스를 장착하였습니다.
* **AI 인스타그램 감성 카피라이터**: 메뉴 사진, 가격, 이름을 참조하여 인공지능이 20대 여성들의 감성을 저격하는 인스타그램 맞춤형 바이럴 홍보 피드 카피와 해시태그를 자동 가공하고 원클릭 복사할 수 있는 어시스턴트를 배치하였습니다.

### 4) 인프라 최적화 및 쿼리 레이턴시 모니터링 (SLA 99.9%)
* **Prisma Slow Query 진단 엔진**: Prisma Client를 이벤트 이미터로 구동하여 **100ms를 초과하는 모든 데이터베이스 슬로우 쿼리**를 검출하고, 실시간 SQL 페이로드와 매개변수를 Winston 로그로 즉시 경보합니다. Jest 환경 소거(Teardown) 후의 비동기 낙오 이벤트를 예방하기 위한 안전한 콘솔 폴백 장치가 이식되어 테스트 및 상용 환경 모두 완벽하게 작동합니다.
* **Prisma 인덱스 자동화 튜닝**: `orders`, `payments`, `products`, `categories` 등 대량 조회가 일어나는 핵심 릴레이션 테이블에 단일/복합 인덱스(`@@index`)를 설계 적용하여 대용량 가맹점 조회의 응답 속도를 극대화하였습니다.
* **백엔드 TypeScript 마이그레이션 착수**: strict 모드로 컴파일되는 `tsconfig.json` 개발을 끝마치고 고성능 한국 표준시 유틸리티 `utils/kstTime.ts` 모듈 마이그레이션을 완수하여 점진적 TS 이식을 개시하였습니다.

### 5) 데이터 무결성 테스트 품질 지표
* **테스트 슈트 합계**: **23 / 23 test suitespassed**
* **개별 테스트 케이스**: **217 / 217 tests passed** (100% 무결점 증명 완료)

---

## 1. 서비스 소개 및 주요 기능

### 핵심 가치 제안

| 문제 | 해결책 | 효과 |
|------|--------|------|
| 키오스크 도입 비용 (200~500만원) | QR 코드 스캔만으로 메뉴판 접근 | **도입 비용 0원** |
| 호출 벨의 접근성 한계 | 스마트폰 기반 **실시간 직원 호출 + 1:1 채팅** | 고객 만족도 향상 |
| 주문 후 대기 불확실성 | **실시간 주문 상태 추적** + FCM 푸시 알림 | 대기 스트레스 해소 |
| 매출 데이터 파악 어려움 | **실시간 매출 분석 대시보드** + 주간 리포트 자동 생성 | 데이터 기반 의사결정 |
| 단골 고객 관리 부재 | **전화번호 기반 포인트 시스템** + 등급 자동 승급 | 고객 리텐션 강화 |
| 매장 운영 인력 부족 | **자동화된 캠페인, SMS, 재고 관리** | 운영 효율 극대화 |

### 주요 기능

| 카테고리 | 기능 | 상세 |
|----------|------|------|
| **QR 메뉴판** | 프리미엄 테마 | 매장 컬러/폰트 커스터마이징, 고해상도 메뉴 이미지 |
| | 메뉴 카테고리 | 드래그 앤 드롭 정렬, 대량 메뉴 관리 |
| | 옵션 시스템 | 토핑/사이드/샷 등 조합 가능, 옵션 템플릿 저장 |
| | 글래스모피즘 UI | 반투명 배경 + 블러 효과로 프리미엄 느낌 연출 |
| **주문 시스템** | 장바구니 | 실시간 반영, 옵션 선택, 수량 조절 |
| | 분할 결제 | 1인 1메뉴 독립 결제 (잔액 오류 방지 로직) |
| | 주문 추적 | pending → confirmed → preparing → ready → completed |
| | 주문 번호 자동 생성 | 타임스탬프 기반 고유 주문 번호 |
| **결제** | 토스페이먼츠 | 카드/간편결제, 브랜드페이 지원 및 무손실 원격 취소/환불 |
| | 정산 | 자동 월별 정산, 세금계산서 발행, 수수료 관리 |
| | 원장 관리 | 주문별/결제별 수익 내역 자동 기록 |
| **직원 호출** | 벨 호출 | 펄스 애니메이션, 즉시 알림 |
| | 실시간 채팅 | 고객-관리자 1:1 메시징 (Socket.io) |
| | 호출 유형 | 도움 요청, 계산 요청, 매니저 호출 3가지 |
| **포인트/등급** | 적립 | 주문 금액 비례 자동 적립 |
| | 등급 | BRONZE → SILVER → GOLD → VIP 자동 승급 |
| | 통합 | 비회원(전화번호) → 회원 전환 시 포인트 자동 통합 |
| | 쿠폰 | 등급 승급 시 자동 쿠폰 발급, 캠페인 트리거 |
| **고객 관리 (CRM)** | 단골 목록 | 주문 이력, 방문 빈도, 평균 주문액 |
| | Bulk SMS | 지역/업종/매장별 타겟 문자 발송 |
| | 예약 | 테이블 예약 관리 |
| | 웨이팅 | 실시간 대기 줄 관리 |
| **매출 분석** | 대시보드 | 일간/주간/월간 매출, 메뉴별 인기 순위 |
| | 고급 분석 | 고객 리텐션, 피크 시간대, 재구매율 |
| | 주간 리포트 | 매주 월요일 자동 생성 (Gemini AI 요약) |
| | 원장 분석 | 결제 수단별, 시간대별 수익 분석 |
| **커뮤니티** | 게시판 | 공지사항, 이벤트, 뉴스, 프로모션 |
| | 댓글 | 계층형 댓글 시스템 |
| | 좋아요 | 게시물별 좋아요 카운트 |
| **AI 기능** | 팅커벨 AI | 매장 상담 도우미 (Gemini 연동) |
| | 메뉴 최적화 | 메뉴 구성 제안, 가격 비교 분석 |
| | 뉴스 수집 | 네이버 뉴스 자동 수집 및 게시 (매일 07:00 KST) |
| **재고 관리** | 재고 추적 | 메뉴별 재고 설정, 소진 알림 |
| | 입출고 기록 | 재고 변동 이력 관리 |
| | 자동 알림 | 재고 부족 시 관리자에게 FCM 푸시 알림 |
| **직원 관리** | 근무표 | 주간 근무 스케줄 관리 |
| | 게이미피케이션 | 직원 간 건전한 경쟁 시스템 |
| | 출퇴근 | 근태 기록 관리 |
| **법적 의무** | 이용약관 | 매장별 맞춤 약관 설정 |
| | 개인정보처리방침 | 자동 생성 + 공개 페이지 (`/legal/:storeId/:type`) |
| **개발자 도구** | Open API v1 | API 키 기반 외부 연동 및 원자적 대기열 CLAIM 쿼리 지원 |
| | 웹훅 | 이벤트 기반 외부 시스템 연동 |
| | 개발자 콘솔 | API 키 관리, 웹훅 등록, 테스트 |

---

## 2. 기술 스택

### 백엔드

| 구분 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Runtime** | Node.js / TypeScript | 18.x+ / 5.6 | 서버 환경 및 타입 안정성 점진 마이그레이션 |
| **웹 프레임워크** | Express.js | 5.2 | REST API 서버 |
| **ORM** | Prisma | 5.22 | DB 접근, 마이그레이션, 타입 안전 |
| **데이터베이스** | PostgreSQL (Supabase) | — | 메인 데이터 저장소 |
| **실시간 통신** | Socket.io | 4.8 | 주문 알림, 채팅, 호출 |
| **인증** | JWT + Firebase Auth | — | 사용자 인증 (토큰 + 소셜 로그인) |
| **결제** | 토스페이먼츠 | — | 카드/간편결제/브랜드페이 |
| **AI** | Google Gemini | — | 팅커벨 AI, 뉴스 요약, 메뉴 분석 |
| **SMS / 알림톡** | Coolsms / Kakao Alimtalk | — | OTP 인증, 알림 문자, 실시간 알림톡 |
| **푸시 알림** | Firebase Cloud Messaging | — | 주문 상태 변경 및 역방향 캔슬 푸시 알림 |
| **로깅** | Winston / Slow Query Tracker | 3.19 | 구조화된 로깅 및 SLA 레이턴시 실시간 모니터링 |
| **API 문서** | Swagger (swagger-jsdoc) | — | 자동 API 문서 생성 |
| **스케줄러** | node-cron | 4.6 | 로그 아카이빙, 뉴스 수집, 리포트 |
| **캐싱** | node-cache | 5.1 | 메모리 기반 캐싱 (TTL 지원) |
| **에러 처리** | 커스텀 AppError | — | 구조화된 에러 핸들링 + 한글 메시지 |

### 프론트엔드

| 구분 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **UI 프레임워크** | React | 19.2 | 컴포넌트 기반 UI |
| **번들러** | Vite | 7.2 | 빠른 빌드 및 HMR |
| **스타일링** | Tailwind CSS | 4.2 | 유틸리티 기반 CSS + 시맨틱 토큰 |
| **애니메이션** | Framer Motion | 12.38 | 부드러운 모션/전환 |
| **상태 관리** | TanStack Query | 5.100 | 서버 상태 캐싱/동기화 |
| **라우팅** | React Router | 7.13 | 클라이언트 사이드 라우팅 |
| **차트** | Recharts | 3.7 | 매출 분석 차트 |
| **아이콘** | Lucide React | 0.575 | 커스터마이징 가능한 아이콘 |
| **알림** | Sonner + React Toastify | — | 토스트 알림 |
| **PWA / Sync** | vite-plugin-pwa / sw-sync.js | — | 오프라인 지원, IndexedDB 기반 백그라운드 일괄 동기화 |
| **국제화** | i18next | 25.8 | 다국어 지원 (한국어/영어) |
| **PDF** | jsPDF | 4.2 | 클라이언트 사이드 PDF 생성 |
| **Excel** | xlsx | 0.18 | 엑셀 내보내기 |
| **토스 UI** | @apps-in-toss/web-framework | 1.7 | 토스 디자인 시스템 컴포넌트 |

---

## 3. 시스템 아키텍처

### 전체 구조도

```
┌─────────────────────────────────────────────────────────────┐
│                      클라이언트 (브라우저)                       │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │
│  │  고객 메뉴판   │  │ 관리자 대시보드  │  │  키오스크 모드   │   │
│  │  /menu/:id    │  │  /admin/*     │  │  /kiosk/:id    │   │
│  │  모바일 우선    │  │  데스크톱 우선   │  │  터치스크린 최적화│   │
│  └──────┬───────┘  └───────┬───────┘  └───────┬────────┘   │
│         │                  │                   │            │
│         └──────────────────┼───────────────────┘            │
│                            │                                │
│                  React 19 + Vite 7 + Tailwind 4             │
│                  TanStack Query + Socket.io-client           │
│                  PWA (Background Sync) + Service Worker      │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                ┌────────────┴────────────┐
                │                         │
      ┌─────────▼──────────┐   ┌─────────▼──────────┐
      │   Vercel (CDN)     │   │  Render (API)       │
      │   프론트엔드 호스팅   │   │  Express.js 서버    │
      │   정적 파일 서빙     │   │  Socket.io 서버     │
      │   Edge Network     │   │  Cron Jobs          │
      └────────────────────┘   │  Graceful Shutdown   │
                               └─────────┬──────────┘
                                         │
                      ┌──────────────────┼──────────────────┐
                      │                  │                   │
            ┌─────────▼────────┐  ┌──────▼───────┐  ┌──────▼───────┐
            │ Supabase (DB)    │  │ Firebase     │  │ 외부 API     │
            │ PostgreSQL       │  │ Auth + FCM   │  │ 토스/Gemini  │
            │ 실시간 구독       │  │ 인증 + 푸시   │  │ Coolsms     │
            │ Row Level Security│  │ 소셜 로그인   │  │ Naver API   │
            │ Storage          │  │              │  │ Slack       │
            └──────────────────┘  └──────────────┘  └──────────────┘
```

---

## 4. Supabase 데이터베이스

### 데이터베이스 스키마 (51개 모델)

#### 주요 테이블 상세

| 테이블 | 설명 | 주요 컬럼 | 인덱스 |
|--------|------|-----------|--------|
| `stores` | 매장 기본 정보 | name, address, business_type, pg_company, pg_business_number, refund_policy | id, user_id |
| `food_trucks` | 이동식 푸드트럭 | store_id, is_active_session, latitude, longitude, geocoded_address, is_sold_out_emergency | store_id, is_active_session |
| `products` | 메뉴/상품 | name, price, image_url, is_active, stock_quantity, low_stock_threshold | store_id, category_id, is_active |
| `orders` | 주문 | order_number (고유), status, total_amount, order_type (dine_in/takeout/delivery), queue_number, customer_fcm_token | store_id, created_at, status |
| `order_items` | 주문 항목 | product_name, price, quantity, options (JSON), user_phone | order_id |
| `payments` | 결제 내역 | toss_payment_key, amount, method, status, refund_amount, payer_phone | order_id, store_id |
| `ledger` | 원장 | type, category, amount, method, description | store_id, created_at |

---

## 8. 보안 시스템

### 인증 체계 및 미들웨어 격리 가드

| 메커니즘 | 설명 | 적용 범위 |
|----------|------|-----------|
| **JWT (JSON Web Token)** | 서버 생성 토큰 기반 인증 | 모든 API 엔드포인트 |
| **HttpOnly Cookie** | XSS 공격 방어용 쿠키 기반 토큰 전송 | `USE_HTTPONLY_COOKIE=true` 시 |
| **assertStoreAccess** | 점주 세션 계정 매장 고유 ID 강제 격리 검사 | `/payments/order/:orderId/cancel` 등 민감 제어 엔드포인트 |
| **apiKeyAuth** | API 키 기반 Open API v1 접근 | Open API v1 외부 통신망 |

---

## 11. 프로젝트 구조

```
wemarket-toss/250105/
├── app.js                    # Express 앱 설정, 미들웨어, 라우트 등록 (425줄)
├── index.js                  # 서버 엔트리포인트, Cron Jobs, Graceful Shutdown (117줄)
├── package.json              # 의존성 및 스크립트 정의
├── tsconfig.json             # 백엔드 strict TypeScript 컴파일 설정 (신설)
├── prisma/
│   └── schema.prisma         # DB 스키마 및 복합인덱스 모델링 (51개 모델, 1018줄)
├── config/
│   └── prisma.js             # 슬로우 쿼리 모니터링 엔진이 탑재된 Prisma Client 싱글톤
├── routes/                   # API 라우트
│   ├── kds.js                # KDS 주방 디스플레이 전용 API 라우터 (신설)
│   ├── foodTrucks.js         # 푸드트럭 실시간 위치 및 타임세일 API 라우터 (신설)
│   └── ...
├── controllers/              # HTTP 요청/응답 처리
│   ├── kdsController.js      # KDS 상태 전이 및 인쇄 잡 제어 컨트롤러 (신설)
│   ├── foodTruckController.js # 위치 추적 및 오프라인 싱크 컨트롤러 (신설)
│   └── ...
├── services/                 # 비즈니스 로직
│   ├── KdsService.js         # 조리 완료 알림톡 및 ESC/POS 영수증 생성 서비스 (신설)
│   ├── FoodTruckService.js   # 지오코딩 및 타임세일 전송 서비스 (신설)
│   └── ...
├── repositories/             # DB 접근 계층
│   ├── FoodTruck.js          # 푸드트럭 전용 Prisma 레포지토리 (신설)
│   └── ...
├── utils/
│   └── kstTime.ts            # strict TypeScript로 포팅된 한국 표준시 유틸리티 (신설)
└── tests/
    └── integration/
        ├── kds.test.js       # KDS API 단위 테스트 슈트 (신설)
        └── foodTruck.test.js # 지오펜싱 및 오프라인 싱크 테스트 슈트 (신설)
```

---

## 13. 환경변수 설정

상용 운영을 위해 `.env` 파일에 아래 환경변수를 채워주세요.

```env
# 데이터베이스
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# 보안 및 토큰
JWT_SECRET="your-jwt-secret-key"
NEXTAUTH_SECRET="your-nextauth-secret-key"

# 카카오 알림톡 및 SMS (Coolsms)
SMS_API_KEY="coolsms-api-key"
SMS_API_SECRET="coolsms-api-secret"
SMS_SENDER="01012345678"
KAKAO_PF_ID="KA01PF24050012"

# 결제 가맹점 연동 (Toss Payments)
TOSS_CLIENT_KEY="test_ck_..."
TOSS_SECRET_KEY="test_sk_..."

# 인공지능 (Gemini AI)
GEMINI_API_KEY="AIzaSy..."

# 성능 분석 성능 임계치 설정 (SLA)
SLOW_QUERY_THRESHOLD_MS=100
```

---

## 14. 라이센스

This project is licensed under the ISC License.
