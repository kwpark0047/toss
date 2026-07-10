# WeMarket (위마켓) - 스마트 QR 메뉴판 및 매장 관리 플랫폼

[![Web App](https://img.shields.io/badge/Web%20App-wemarket.vercel.app-blue?style=for-the-badge)](https://wemarket.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-green?style=for-the-badge)](https://wemarket-toss.onrender.com)
[![Database](https://img.shields.io/badge/DB-Supabase-purple?style=for-the-badge)](https://supabase.com)
[![License](https://img.shields.io/badge/License-ISC-lightgrey?style=for-the-badge)](#)

> **WeMarket**은 소상공인을 위한 프리미엄 QR 메뉴판 및 통합 매장 관리 솔루션입니다.
> 고객은 앱 설치 없이 **QR 코드 스캔만으로** 메뉴 확인, 주문, 호출, 결제를 진행할 수 있으며,
> 관리자는 **실시간 대시보드**를 통해 매장 운영을 효율화할 수 있습니다.

---

## 라이브 서비스

| 구분 | URL | 설명 |
|------|-----|------|
| **웹 앱 (메인)** | [wemarket.vercel.app](https://wemarket.vercel.app) | 고객용 메뉴판 + 관리자 대시보드 통합 |
| **백엔드 API** | [wemarket-toss.onrender.com](https://wemarket-toss.onrender.com) | REST API + Socket.io 실시간 서버 |
| **API 문서** | [/api/docs](https://wemarket-toss.onrender.com/api/docs) | Swagger UI 기반 API 레퍼런스 |

---

## 목차

1. [서비스 소개 및 주요 기능](#1-서비스-소개-및-주요-기능)
2. [기술 스택](#2-기술-스택)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [Supabase 데이터베이스](#4-supabase-데이터베이스)
5. [Render 배포 및 인프라](#5-render-배포-및-인프라)
6. [개발 과정](#6-개발-과정)
7. [사용법](#7-사용법)
8. [보안 시스템](#8-보안-시스템)
9. [알림 시스템](#9-알림-시스템)
10. [프론트엔드 UI/UX](#10-프론트엔드-uiux)
11. [프로젝트 구조](#11-프로젝트-구조)
12. [API 엔드포인트](#12-api-엔드포인트)
13. [환경변수 설정](#13-환경변수-설정)
14. [지속적 배포 (CI/CD)](#14-지속적-배포-cicd)

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
| **결제** | 토스페이먼츠 | 카드/간편결제, 브랜드페이 지원 |
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
| **개발자 도구** | Open API v1 | API 키 기반 외부 연동 |
| | 웹훅 | 이벤트 기반 외부 시스템 연동 |
| | 개발자 콘솔 | API 키 관리, 웹훅 등록, 테스트 |

---

## 2. 기술 스택

### 백엔드

| 구분 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Runtime** | Node.js | 18.x+ | 서버 환경 |
| **웹 프레임워크** | Express.js | 5.2 | REST API 서버 |
| **ORM** | Prisma | 5.22 | DB 접근, 마이그레이션, 타입 안전 |
| **데이터베이스** | PostgreSQL (Supabase) | — | 메인 데이터 저장소 |
| **실시간 통신** | Socket.io | 4.8 | 주문 알림, 채팅, 호출 |
| **인증** | JWT + Firebase Auth | — | 사용자 인증 (토큰 + 소셜 로그인) |
| **결제** | 토스페이먼츠 | — | 카드/간편결제/브랜드페이 |
| **AI** | Google Gemini | — | 팅커벨 AI, 뉴스 요약, 메뉴 분석 |
| **SMS** | Coolsms | — | OTP 인증, 알림 문자 |
| **푸시 알림** | Firebase Cloud Messaging | — | 주문 상태 변경 푸시 |
| **로깅** | Winston | 3.19 | 구조화된 로깅 (JSON 포맷) |
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
| **PWA** | vite-plugin-pwa | — | 설치 가능 웹 앱, 오프라인 지원 |
| **국제화** | i18next | 25.8 | 다국어 지원 (한국어/영어) |
| **PDF** | jsPDF | 4.2 | 클라이언트 사이드 PDF 생성 |
| **Excel** | xlsx | 0.18 | 엑셀 내보내기 |
| **토스 UI** | @apps-in-toss/web-framework | 1.7 | 토스 디자인 시스템 컴포넌트 |

### 인프라 및 배포

| 구분 | 서비스 | 역할 |
|------|--------|------|
| **프론트엔드 배포** | Vercel | React SPA 호스팅, CDN, 자동 배포 |
| **백엔드 호스팅** | Render | Express API 서버, Socket.io, Cron Jobs |
| **데이터베이스** | Supabase (PostgreSQL) | 클라우드 DB, 실시간 구독, RLS |
| **인증** | Firebase Authentication | 소셜 로그인 (Google, 카카오 등) |
| **저장소** | Supabase Storage | 메뉴 이미지 업로드 |

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
│                  PWA + Service Worker                        │
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

### 백엔드 아키텍처 (4-Layer Pattern)

```
┌──────────────────────────────────────────────────────────┐
│                     routes/ (39개 파일)                    │
│           라우팅 + 미들웨어 + 요청 검증 (Joi)                │
│           authLimiter / orderLimiter / paymentLimiter     │
└───────────────────────────┬──────────────────────────────┘
                            │
               ┌────────────▼────────────┐
               │   controllers/ (13개)    │
               │   HTTP 요청/응답 처리     │
               │   req.body → Service 호출│
               │   res.success() / res.error() │
               └────────────┬────────────┘
                            │
               ┌────────────▼────────────┐
               │    services/ (18개)      │
               │    비즈니스 로직          │
               │    트랜잭션 / 검증 / 규칙 │
               │    알림 / 외부 API 호출   │
               └────────────┬────────────┘
                            │
               ┌────────────▼────────────┐
               │  repositories/ (20개)    │
               │  DB 접근 계층            │
               │  Prisma Client 래퍼     │
               │  CRUD + 복합 쿼리        │
               └────────────┬────────────┘
                            │
               ┌────────────▼────────────┐
               │    Prisma ORM           │
               │    PostgreSQL (Supabase)│
               │    50개 모델, 990줄 스키마│
               └─────────────────────────┘
```

### 데이터 흐름 (주문 생성 예시)

```
1. 고객 "주문하기" 클릭
     ↓
2. POST /api/orders (요청)
     ↓
3. routes/orders.js → authMiddleware → orderLimiter
     ↓
4. orderController.createOrder()
   - req.body 검증 (Joi)
   - StoreService 확인
     ↓
5. OrderService.createOrder()
   - 주문 번호 생성 (타임스탬프 기반)
   - 재고 확인/차감
   - 포인트 적립 계산
   - 등급 승급 확인 → 쿠폰 자동 발급
   - Prisma 트랜잭션 시작
     ↓
6. repositories/Order.create() + OrderItem.createMany()
   - DB 저장
     ↓
7. notificationService.notifyNewOrderDB()
   - DB 알림 레코드 저장
   - Socket.io → 매장 룸 실시간 전송
   - FCM → 관리자 푸시 알림
     ↓
8. 클라이언트에 주문 완료 응답
```

---

## 4. Supabase 데이터베이스

### Supabase란?

[Supabase](https://supabase.com)는 오픈소스 Firebase 대안으로, **PostgreSQL 기반**의 완전한 백엔드 서비스입니다. Firebase와 달리 모든 데이터가 SQL 데이터베이스에 저장되므로 복잡한 관계형 데이터 모델링이 가능합니다.

### WeMarket에서 사용하는 Supabase 기능

| 기능 | 용도 | 상세 |
|------|------|------|
| **PostgreSQL DB** | 모든 비즈니스 데이터 저장 | 매장, 메뉴, 주문, 결제, 포인트 등 50개+ 테이블 |
| **실시간 구독 (Realtime)** | 주문 접수 시 관리자 즉시 알림 | `orders` 테이블 변경 감지 → Socket.io 전달 |
| **Row Level Security (RLS)** | 데이터 접근 제어 | 매장별 데이터 격리, API 키 기반 접근 |
| **Supabase Storage** | 파일 저장소 | 메뉴 이미지, 프로필 사진 등 |
| **Edge Functions** | 서버리스 함수 | 특정 이벤트 처리 (웹훅 등) |
| **데이터베이스 트리거** | 이벤트 기반 자동화 | 주문 생성 시 포인트 적립, 상태 변경 시 알림 등 |

### 데이터베이스 스키마 (50개 모델)

#### 핵심 엔티티 관계

```
stores (매장) ──────────────────────────────────────┐
├── categories (카테고리)                             │
│   └── products (상품)                              │
│       └── order_items (주문 항목)                   │
├── orders (주문)                                    │
│   ├── order_items (주문 항목)                      │
│   ├── payments (결제)                              │
│   └── ledger (원장)                               │
├── tables (테이블)                                  │
├── staff (직원)                                     │
│   ├── staff_attendance (근태)                     │
│   └── staff_schedules (근무표)                    │
├── store_customers (단골 고객)                       │
│   ├── user_points (포인트)                         │
│   └── store_tier_settings (등급 설정)              │
├── coupons (쿠폰)                                   │
│   └── user_coupons (발급된 쿠폰)                   │
├── campaign_settings (캠페인 설정)                   │
├── community_posts (커뮤니티 게시물)                  │
│   ├── comments (댓글)                              │
│   └── post_likes (좋아요)                          │
├── reviews (리뷰)                                   │
│   └── review_likes (리뷰 좋아요)                   │
├── reservations (예약)                              │
├── waiting_list (웨이팅)                            │
├── notifications (알림)                             │
├── notification_templates (알림 템플릿)              │
├── store_receipt_settings (영수증 설정)              │
├── store_point_settings (포인트 설정)                │
├── stock_history (입출고 기록)                       │
├── store_partnerships (제휴)                        │
└── store_favorites (즐겨찾기)                       │

users (사용자) ──────────────────────────────────────┐
├── store_accounts (매장 계정 관계)                    │
├── store_staff (매장-직원 관계)                      │
├── phone_otps (전화번호 OTP)                        │
├── chat_rooms / chat_messages (채팅)                │
├── shared_cart_items (공유 장바구니)                  │
└── api_keys (API 키)                               │

webhook_endpoints (웹훅)                             │
├── webhook_deliveries (전송 이력)                    │
└── print_jobs (프린트 작업)                          │
```

#### 주요 테이블 상세

| 테이블 | 설명 | 주요 컬럼 | 인덱스 |
|--------|------|-----------|--------|
| `stores` | 매장 기본 정보 | name, address, business_type, theme_color, commission_rate, vat_rate | id, user_id |
| `products` | 메뉴/상품 | name, price, image_url, is_available, stock_quantity, low_stock_threshold | store_id, category_id |
| `orders` | 주문 | order_number (고유), status, total_amount, order_type (dine_in/takeout/delivery), queue_number | store_id, created_at, status |
| `order_items` | 주문 항목 | product_name, price, quantity, options (JSON), user_phone (분할결제용) | order_id |
| `payments` | 결제 내역 | toss_payment_key, amount, method, status, refund_amount | order_id, store_id |
| `ledger` | 원장 | type, category, amount, method, description | store_id, created_at |
| `store_customers` | 단골 고객 | customer_phone, total_orders, total_spent, current_tier, visit_count | store_id, phone |
| `user_points` | 포인트 | balance, earned, used, expired | customer_phone |
| `store_tier_settings` | 등급 설정 | tier_name (BRONZE/SILVER/GOLD/VIP), min_spend, discount_rate | store_id |
| `coupons` | 쿠폰 | discount_type, discount_value, expiry_date, min_purchase | store_id |
| `chat_messages` | 채팅 메시지 | sender_id, content, read_at, message_type | room_id, created_at |
| `community_posts` | 커뮤니티 | type (EVENT/PROMOTION/NEWS/PRODUCT), content, image_urls, expires_at | store_id, type |
| `reviews` | 리뷰 | rating (1~5), content, images | store_id, order_id |
| `notifications` | 알림 | type, title, message, data (JSON), priority, link, read_at | store_id, created_at |
| `api_keys` | API 키 | key_hash, name, permissions, rate_limit, expires_at | key_hash |

#### 주문 상태 흐름

```
pending (접수 대기)
  ↓ 관리자 수락
confirmed (확인됨)
  ↓ 조리 시작
preparing (조리 중)
  ↓ 조리 완료
ready (준비 완료)
  ↓ 고객 수령
completed (완료)
  ↓
cancelled (취소 — 고객 또는 관리자에 의한)
```

각 상태 변경 시 자동으로:
1. DB에 알림 레코드 저장 (`notifications`)
2. Socket.io로 실시간 전송 (고객 + 매장)
3. FCM으로 푸시 알림 발송 (중요 상태일 때만: confirmed, ready, cancelled)

#### 등급 시스템

```
BRONZE (기본)
  ↓ 누적 10만원 이상
SILVER (추가 할인 적용)
  ↓ 누적 50만원 이상
GOLD (더 큰 할인 적용)
  ↓ 누적 100만원 이상
VIP (최대 할인 혜택)
```

등급 승급 시 자동으로:
1. `store_tier_settings`에서 해당 등급의 쿠폰 ID 확인
2. `campaign_settings`에서 트리거된 캠페인 확인
3. `user_coupons`에 쿠폰 자동 발급
4. SMS로 승급 알림 발송

---

## 5. Render 배포 및 인프라

### Render란?

[Render](https://render.com)는 현대적인 클라우드 호스팅 플랫폼으로, Git 푸시만으로 자동 배포됩니다. Heroku 대안으로 인기가 높으며, Free 플랜으로 시작 가능합니다.

### WeMarket의 Render 활용

| 항목 | 설정 | 설명 |
|------|------|------|
| **서비스 타입** | Web Service | Node.js 웹 서버 |
| **이름** | `wemarket` | 서비스 식별자 |
| **런타임** | Node.js | Express 기반 API 서버 |
| **리전** | Singapore (ap-southeast-1) | Supabase와 동일 리전 → DB 왕복 지연 최소화 |
| **플랜** | Free | 트래픽 기반 자동 스케일링 (Cold Start 30초~) |
| **빌드 명령** | `npm install && npx prisma generate` | 의존성 설치 + Prisma 클라이언트 생성 |
| **시작 명령** | `node index.js` | 서버 시작 |
| **헬스체크** | `/api/health` | 서비스 생존 여부 모니터링 |
| **자동 배포** | `autoDeploy: true` | `main` 브랜치 푸시 시 자동 재배포 |

### Render가 수행하는 작업

#### 1. API 서버 (Express + Socket.io)

```
클라이언트 요청 → Express 라우터 → Middleware (CORS/Auth/RateLimit)
    → Controller → Service → Repository → Prisma → PostgreSQL
                                                         ↑
Socket.io (실시간) ← 주문 알림, 채팅, 호출 ←─────────────┘
```

- **REST API**: 39개 라우트 모듈, 200+ 엔드포인트
- **Socket.io**: 실시간 주문 상태, 채팅 메시지, 직원 호출
- **Cron Jobs**: 서버 시작 시 스케줄러 자동 등록

#### 2. 자동 스케줄러 (Cron Jobs)

| 스케줄 | 작업 | 설명 |
|--------|------|------|
| **매주 월요일 09:00 KST** | 주간 매출 리포트 | Gemini AI가 매출 데이터를 분석하여 요약 리포트 생성, 커뮤니티에 자동 게시 |
| **매일 07:00 KST** | 뉴스 자동 수집 | 네이버 뉴스에서 관련 기사를 수집하여 커뮤니티에 자동 게시 |
| **매월 1일 04:00 KST** | 로그 아카이빙 | 6개월 이상 오래된 로그를 아카이브하여 DB 성능 최적화 |
| **서버 시작 시** | 웹훅 재시도 스케줄러 | 실패한 웹훅 전송을 자동 재시도 |
| **서버 시작 시** | 알림 템플릿 초기화 | 매장 연동 요청 관련 기본 알림 템플릿 등록 |

#### 3. Graceful Shutdown

Render는 배포/재시작 전 `SIGTERM` 시그널을 전송합니다. WeMarket은 이를 안전하게 처리합니다:

```
SIGTERM 수신
  ↓ 1. 신규 연결 차단 (httpServer.close)
  ↓ 2. Socket.io 연결 종료
  ↓ 3. Prisma 연결 해제
  ↓ 4. 최대 30초 대기 → 강제 종료 (timeout.unref)
  ↓
안전한 종료 완료
```

#### 4. `render.yaml` (Infrastructure as Code)

```yaml
services:
  - type: web
    name: wemarket
    runtime: node
    region: singapore          # Supabase와 동일 리전
    plan: free
    branch: main
    buildCommand: npm install && npx prisma generate
    startCommand: node index.js
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false            # Render 대시보드에서 수동 입력
      - key: JWT_SECRET
        sync: false
      - key: TOSS_SECRET_KEY
        sync: false
      # ... (총 20+ 환경변수)
```

---

## 6. 개발 과정

### Phase 1: 기획 및 설계 (2주)

1. **시장 조사**: 소상공인 키오스크 도입 비용 분석
   - 키오스크 하드웨어: 200~500만원
   - 월 유지비: 5~10만원
   - 업데이트 비용: 별도
   - **문제점**: 높은 초기 비용, 업데이트 어려움, 고장 시 대체 불가

2. **페인 포인트 도출**:
   - 높은 키오스크 도입 비용 → QR 코드로 즉시 해결
   - 호출 벨의 접근성 한계 → 스마트폰 기반 실시간 호출
   - 주문 후 대기 불확실성 → 실시간 상태 추적
   - 매출 데이터 파악 어려움 → 실시간 분석 대시보드

3. **솔루션 기획**:
   - 모바일 웹 기반 QR 메뉴판 (앱 설치 불필요)
   - 관리자 대시보드 (실시간 주문/매출 관리)
   - 고객-매장 실시간 소통 (채팅/호출)

4. **技术选型**:
   - React (SPA) + Tailwind CSS (빠른 스타일링)
   - Express (경량 API) + Socket.io (실시간)
   - PostgreSQL (관계형 DB) + Prisma (ORM)
   - Vercel + Render (무료 배포)

### Phase 2: 데이터베이스 설계 (1주)

1. **Prisma 스키마 설계**: 50개 모델, 정규화된 테이블 구조
   - 핵심 엔티티: stores, products, orders, payments, users
   - 관계 엔티티: order_items, ledger, store_customers, user_points
   - 부가 엔티티: coupons, reviews, community_posts, notifications

2. **RLS 정책**: 매장별 데이터 격리
   - API 키 기반 접근 제어
   - 사용자 역할별 권한 분리 (super_admin, owner, staff, customer)

3. **인덱스 최적화**: 조회 성능 향상
   - 복합 인덱스: (store_id, created_at), (store_id, status)
   - 부분 인덱스: 활성 매장만 조회

4. **마이그레이션 관리**: Prisma Migrate 기반 버전 관리

### Phase 3: 백엔드 개발 (3주)

1. **API 설계**: RESTful 원칙 기반 200+ 엔드포인트
   - 일관된 응답 포맷: `{ success, data, message }`
   - 에러 코드 체계: 1000~1099 (인증), 2000~2099 (비즈니스)

2. **아키텍처 패턴**: Route → Controller → Service → Repository 4계층 분리
   - **routes**: 라우팅 + 미들웨어 + 요청 검증
   - **controllers**: HTTP 요청/응답 처리
   - **services**: 비즈니스 로직 (트랜잭션, 검증, 규칙)
   - **repositories**: DB 접근 계층 (Prisma Client 래퍼)

3. **인증 시스템**:
   - JWT + HttpOnly Cookie (보안 강화)
   - Firebase Auth (Google, 카카오 소셜 로그인)
   - OTP 인증 (전화번호 기반 비회원 인증)

4. **실시간 통신**: Socket.io 기반
   - 주문 상태 변경 → 고객/매장 동시 알림
   - 1:1 채팅 → 룸 기반 메시징
   - 직원 호출 → 매장 전체 알림

5. **외부 서비스 연동**:
   - 토스페이먼츠: 결제/환불/정산
   - Coolsms: OTP/SMS 발송
   - Firebase FCM: 푸시 알림
   - Gemini AI: 팅커벨 AI, 뉴스 요약
   - Naver API: 매장 정보 보강

### Phase 4: 프론트엔드 개발 (3주)

1. **컴포넌트 아키텍처**: 페이지별 lazy loading, 공통 컴포넌트 추출
   - React.lazy() + Suspense로 코드 스플리팅
   - 60+ 페이지/컴포넌트 분리

2. **UI/UX 디자인**:
   - Tailwind CSS 기반 모바일 퍼스트
   - TDS (Toss Design System) 컨벤션 준수
   - 시맨틱 토큰 시스템 (cust-bg-base, cust-text-main 등)
   - 글래스모피즘 효과 (반투명 + 블러)

3. **애니메이션**: Framer Motion 기반
   - 페이지 전환, 모달 열기/닫기
   - 메뉴 카드 터치 피드백
   - 직원 호출 펄스 애니메이션

4. **PWA 구현**:
   - 설치 가능 웹 앱 (manifest.json)
   - Service Worker (오프라인 지원)
   - 업데이트 알림 (PWAUpdateNotification)

5. **반응형**: 모바일(360px+) ~ 태블릿 ~ 데스크톱

### Phase 5: 안정화 및 최적화 (2주)

1. **아키텍처 리팩토링**: Repository Pattern 도입
   - DB 접근 계층 분리로 유지보수성 향상
   - 테스트 용이성 확보

2. **보안 강화**:
   - CORS 화이트리스트 (프로덕션)
   - Rate Limiting (5종류)
   - CSP (Content Security Policy)
   - SSRF 가드 (웹훅 URL 검증)
   - HttpOnly Cookie 기반 JWT

3. **모니터링**:
   - Winston 구조화된 로깅
   - 성능 메트릭 수집 (응답 시간, 상태 코드)
   - Slack 알림 시스템 (장애 발생 시)
   - 헬스체크 엔드포인트

4. **테스트**: Unit/Integration/Regression/E2E
   - Jest + React Testing Library
   - Playwright E2E (모바일/데스크톱)

5. **배포 자동화**: Vercel + Render CI/CD

---

## 7. 사용법

### 고객용 (메뉴판 접속)

#### 방법 1: QR 코드 스캔

```
1. 매장 테이블에 부착된 QR 코드를 스캔합니다.
   → URL 형식: https://wemarket.vercel.app/qr/{qrCode}

2. 브라우저에서 메뉴판이 자동으로 열립니다.
   → URL 형식: https://wemarket.vercel.app/menu/{storeId}

3. 카테고리를 선택하여 메뉴를 둘러봅니다.
   → 좌우 스와이프 또는 탭으로 카테고리 전환

4. 원하는 메뉴를 탭하여 상세 정보를 확인합니다.
   → 메뉴 이미지, 설명, 가격, 옵션 표시

5. 옵션(토핑, 사이드, 샷 등)을 선택합니다.
   → 필수 옵션은 반드시 선택해야 합니다
   → 추가 옵션은 선택적으로 선택합니다

6. "장바구니 담기" 버튼을 누릅니다.
   → 장바구니 아이템 수 표시 (하단 고정)

7. 장바구니에서 주문 내용을 확인하고 "주문하기"를 누릅니다.
   → 전체 합계, 개별 항목 표시

8. 전화번호를 입력하여 주문 접수 알림을 받습니다.
   → 비회원도 전화번호만으로 주문 가능

9. 주문 상태가 실시간으로 변경됩니다:
   - 🟡 pending (접수 대기) → 관리자가 주문 확인 중
   - 🟢 confirmed (확인됨) → 주문이 확인되었습니다
   - 🟠 preparing (조리 중) → 음식을 준비 중입니다
   - 🔵 ready (준비 완료) → 수령 가능합니다
   - ✅ completed (완료) → 수령 완료

10. 도움이 필요할 땐 우측 하단의 "직원 호출" 버튼을 누릅니다.
    → 🔔 벨 울리기: 매장 직원에게 즉시 알림
    → 💬 채팅하기: 관리자와 1:1 실시간 채팅
```

#### 방법 2: 매장 검색

```
1. https://wemarket.vercel.app/search 에 접속합니다.

2. 검색 필터를 사용합니다:
   - 지역: 시/도, 시/군/구별 필터링
   - 업종: 음식점, 카페, 숙박 등
   - 키워드: 매장명, 주소 검색

3. 내 위치 허용 시 거리순 정렬로 가까운 매장을 찾습니다.
   → GPS 좌표 기반 하버사인 공식으로 거리 계산

4. 원하는 매장을 선택하면 메뉴판으로 이동합니다.
```

#### 방법 3: 직접 URL 입력

```
https://wemarket.vercel.app/menu/{매장ID}
```

#### 직원 호출 방법

```
1. 메뉴판 우측 하단의 "직원 호출" 버튼을 탭합니다.

2. 호출 유형을 선택합니다:
   - 🔔 벨 울리기: 매장 직원에게 즉시 알림 (진동 + 소리)
   - 💬 채팅하기: 관리자와 1:1 실시간 채팅 시작
   - 💰 계산 요청: 계산서 요청
   - ❓ 도움 요청: 기타 도움 요청

3. 채팅에서 요청 사항을 입력하고 전송합니다.
   → 실시간으로 관리자에게 전달

4. 관리자가 응답하면 알림이 옵니다.
   → 푸시 알림 + 화면 내 메시지
```

#### 포인트 적립

```
1. 주문 시 전화번호를 입력하면 자동으로 포인트가 적립됩니다.
   → 적립률은 매장 설정에 따라 다릅니다 (기본 1%)

2. 포인트 내역은 다음에서 확인할 수 있습니다:
   → 프로필 페이지 → 포인트 탭

3. 포인트는 다음 주문 시 현금처럼 사용할 수 있습니다.
   → 주문 시 "포인트 사용" 체크박스 선택

4. 누적 금액에 따라 등급이 자동 승급됩니다:
   - BRONZE: 기본 (0~99,999원)
   - SILVER: 10만원 이상 → 추가 할인 + 웰컴 쿠폰
   - GOLD: 50만원 이상 → 더 큰 할인 + 생일 쿠폰
   - VIP: 100만원 이상 → 최대 할인 + 전용 혜택

5. 등급 승급 시 자동으로 쿠폰이 발급됩니다.
   → 알림 + SMS로 승급 소식 전달
```

### 관리자용 (매장 관리)

#### 로그인 및 매장 선택

```
1. https://wemarket.vercel.app/auth 에 접속합니다.

2. 로그인 방법을 선택합니다:
   - 이메일/비밀번호: 일반 회원가입/로그인
   - Google 소셜 로그인
   - 카카오 소셜 로그인

3. "매장 관리" 탭에서 관리할 매장을 선택합니다.
   → 여러 매장 동시 관리 가능

4. 첫 로그인 시 "매장 설정 마법사"가 표시됩니다.
   → 단계별로 매장 정보를 입력합니다
```

#### 매장 설정 (최초 1회)

```
1단계: 기본 정보
   - 매장 이름, 주소, 업종, 전화번호
   - 영업 시간, 휴무일

2단계: 디자인 설정
   - 테마 컬러 (primary, accent)
   - 폰트 선택 (Noto Sans KR 등)
   - 로고 이미지 업로드

3단계: 사업자 정보
   - 사업자등록번호, 대표자명
   - 업태, 종목
   - 세금계산서 발행용 정보

4단계: 결제 설정
   - 토스페이먼츠 연동
   - 수수료율 설정
   - 정산 주기 설정

5단계: QR 코드 생성
   - 테이블별 QR 코드 생성
   - QR 코드 다운로드 (PNG/PDF)
   - 테이블에 부착
```

#### 메뉴 관리

```
1. 좌측 메뉴에서 "메뉴 관리"를 선택합니다.

2. 카테고리를 추가/편집합니다:
   - 카테고리명 입력
   - 정렬 순서 변경 (드래그 앤 드롭)
   - 카테고리 삭제 (메뉴가 있으면 삭제 불가)

3. 각 카테고리에 메뉴를 추가합니다:
   - 메뉴명, 가격, 설명
   - 메뉴 이미지 업로드 (드래그 앤 드롭)
   - 옵션 그룹 추가 (예: 사이즈: 레귤러/라지)
   - 재고 수량 설정 (선택)
   - 판매 여부 설정

4. 옵션 템플릿을 관리합니다:
   - 자주 사용하는 옵션 조합을 템플릿으로 저장
   - 다음 메뉴 추가 시 템플릿 선택으로 빠른 적용

5. "메뉴 비주얼 빌더"에서 메뉴판 미리보기가 가능합니다.
   - 고객이 보는 화면을 실시간으로 확인
   - 테마 컬러 변경 시 즉시 반영
```

#### 실시간 주문 관리

```
1. "주문 관리" 탭으로 이동합니다.

2. 새 주문이 접수되면:
   - 실시간 알림 (소리 + 진동)
   - 주문 상세 정보 표시 (메뉴, 옵션, 수량, 합계)
   - 고객 전화번호 표시

3. 주문 상태를 업데이트합니다:
   - "확인" 버튼 클릭 → confirmed 상태로 변경
   - "조리 중"으로 변경 → preparing 상태로 변경
   - "준비 완료"로 변경 → ready 상태로 변경
   - "완료"로 변경 → completed 상태로 변경

4. 상태 변경 시 자동으로:
   - 고객에게 FCM 푸시 알림 전송
   - Socket.io로 실시간 상태 업데이트
   - 주방 디스플레이에 표시

5. 필터 기능:
   - 상태별 필터 (대기중/확인/조리중/준비완료)
   - 시간 필터 (오늘/이번 주/이번 달)
   - 검색 (주문번호, 고객 전화번호)
```

#### 매출 분석

```
1. "매출 통계" 탭에서 매출 데이터를 확인합니다.

2. 대시보드에서 확인 가능한 정보:
   - 오늘의 매출/주문 건수
   - 일간/주간/월간 매출 추이 (차트)
   - 메뉴별 판매 순위 (상위 10개)
   - 결제 수단별 비율 (카드/간편결제/현금)
   - 피크 시간대 분석

3. "고급 분석"에서 확인 가능한 정보:
   - 고객 리텐션 (재방문율)
   - 평균 주문 금액
   - 고객당 평균 방문 횟수
   - 메뉴별 수익 기여도

4. 주간 리포트:
   - 매주 월요일 자동 생성
   - Gemini AI가 매출 데이터를 분석하여 요약
   - 커뮤니티에 자동 게시
```

#### 정산 관리

```
1. "정산" 탭에서 월별 정산 내역을 확인합니다.

2. 자동 정산 생성:
   - 관리자가 기간을 선택 (예: 2024년 1월)
   - "정산 생성" 버튼 클릭
   - 시스템이 해당 기간의 주문/결제 데이터를 분석
   - 정산 보고서 자동 생성

3. 정산 보고서 내용:
   - 총 매출액
   - 결제 수단별 내역
   - 수수료 공제
   - 부가세
   - 순수익

4. 세금계산서 발행:
   - 필요 시 자동 발행
   - 국세청 홈택스 연동

5. 수수료율 설정:
   - 슈퍼관리자가 매장별 수수료율 조정
   - 기본 수수료율: 2.5% (카드 결제 기준)
```

---

## 8. 보안 시스템

### 인증 체계

| 메커니즘 | 설명 | 적용 범위 |
|----------|------|-----------|
| **JWT (JSON Web Token)** | 서버 생성 토큰 기반 인증 | 모든 API 엔드포인트 |
| **HttpOnly Cookie** | XSS 공격 방어용 쿠키 기반 토큰 전송 | `USE_HTTPONLY_COOKIE=true` 시 |
| **Firebase Auth** | 소셜 로그인 (Google, 카카오) | 프론트엔드 인증 |
| **OTP 인증** | 전화번호 기반 일회용 비밀번호 | 비회원 주문 시 |
| **API 키 인증** | 외부 개발자 API 접근 | Open API v1 |

### 인증 흐름

```
1. 로그인 요청 (이메일/비밀번호 또는 소셜)
   ↓
2. 서버에서 JWT 토큰 생성
   - Access Token (15분)
   - Refresh Token (7일)
   ↓
3. 토큰 전송
   - HttpOnly Cookie (보안 강화)
   - 또는 Authorization 헤더 (Bearer 토큰)
   ↓
4. 요청 시 토큰 검증
   - authMiddleware가 토큰 확인
   - 만료 시 401 응답
   - Refresh Token으로 갱신 가능
```

### Rate Limiting (속도 제한)

| 유형 | 한도 | 윈도우 | 적용 |
|------|------|--------|------|
| **일반 API** | 100회/IP | 1분 | 전체 API |
| **주문 생성** | 30회/IP+매장 | 1분 | POST /api/orders |
| **인증** | 10회/IP | 15분 | 로그인/회원가입 |
| **SMS** | 3회/IP | 10분 | OTP/SMS 발송 |
| **결제** | 10회/IP | 1분 | 결제 생성/환불 |

### 보안 헤더 (Helmet)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

### SSRF 방어

웹훅 URL 등록 시 내부 네트워크 주소를 차단합니다:

- **DNS 해석 후 검증**: 도메인을 IP로 변환하여 내부 대역 확인
- **프로토콜 강제**: 프로덕션에서는 HTTPS만 허용
- **차단 대상**: loopback (127.0.0.0/8), 사설 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), 링크로컬 (169.254.0.0/16)

### 데이터 보안

| 항목 | 방법 |
|------|------|
| **비밀번호** | bcryptjs로 해싱 (salt 10) |
| **전화번호** | AES-256 암호화 저장 |
| **API 키** | 해시 처리 후 저장 (원본 비저장) |
| **JWT 시크릿** | 환경변수로 관리 (Git 미커밋) |
| **시크릿 키** | Render 대시보드에서 수동 입력 |

---

## 9. 알림 시스템

### 알림 채널

| 채널 | 용도 | 지연 시간 |
|------|------|-----------|
| **Socket.io** | 실시간 주문/채팅/호출 | 즉시 (< 100ms) |
| **FCM (Firebase)** | 푸시 알림 (앱 미접속 시) | 1~3초 |
| **SMS (Coolsms)** | OTP/SMS 알림 | 3~10초 |
| **DB 알림** | 이력 관리 + 백그라운드 확인 | 즉시 |

### 알림 유형

| 유형 | 트리거 | 채널 | 우선순위 |
|------|--------|------|----------|
| `NEW_ORDER` | 새 주문 접수 | Socket.io + FCM | high |
| `ORDER_STATUS` | 주문 상태 변경 | Socket.io + FCM | normal~high |
| `LOW_STOCK` | 재고 부족 | DB + FCM | urgent |
| `NEW_RESERVATION` | 새 예약 신청 | DB | normal |
| `NEW_REVIEW` | 새 리뷰 등록 | DB | low |
| `MANAGER_CALL` | 매니저 호출 | DB + Socket.io | urgent |
| `SETTLEMENT` | 정산 생성 | DB | normal |
| `STORE_LINK` | 매장 연동 요청 | DB | normal |

### 알림 템플릿 시스템

관리자가 커스텀 알림 템플릿을 설정할 수 있습니다:

```
유형: NEW_ORDER
제목: 🛎️ 새 주문 접수
내용: {{tableName}}에서 주문이 들어왔습니다. (주문번호: {{orderNumber}})
변수: tableName, orderNumber, storeId
채널: all (Socket.io + FCM + DB)
활성화: ✅
```

---

## 10. 프론트엔드 UI/UX

### 디자인 시스템

| 구분 | 설정 | 설명 |
|------|------|------|
| **브랜드 컬러** | Primary: Warm Orange (#F97316) | 따뜻한 느낌의 메인 컬러 |
| | Accent: Coral (#FB923C) | 포인트 컬러 |
| | Navy: #191F28 | 다크 배경 |
| | Cream: #FFFBEB | 라이트 배경 |
| **폰트** | Noto Sans KR | 한국어 최적화 |
| **그레이 스케일** | TDS 표준 (grey-50 ~ grey-900) | 토스 디자인 시스템 기반 |
| **테두리 반경** | 1rem (lg), 0.875rem (md), 0.75rem (sm) | 둥근 모서리 |
| **그림자** | sm, md, lg, glow | 계층별 그림자 |

### 시맨틱 토큰 (CSS 변수)

```css
/* 라이트 모드 */
--customer-bg-base: #f2f4f6;      /* grey-100 배경 */
--customer-bg-card: #ffffff;       /* 카드 배경 */
--customer-text-main: #191f28;     /* grey-900 텍스트 */
--customer-text-sub: #6b7684;      /* grey-600 보조 텍스트 */
--customer-border: #f2f4f6;        /* 테두리 */
--customer-divider: #f9fafb;       /* 구분선 */

/* 다크 모드 */
--customer-bg-base: #000000;       /* 순수 검정 배경 */
--customer-bg-card: #191f28;       /* grey-900 카드 */
--customer-text-main: #f2f4f6;     /* grey-100 텍스트 */
--customer-text-sub: #8b95a1;      /* grey-500 보조 텍스트 */
--customer-border: #333d4b;        /* grey-800 테두리 */
--customer-divider: #191f28;       /* grey-900 구분선 */
```

### 다크모드 구현

- 시스템 `prefers-color-scheme` 감지하여 자동 전환
- `.dark` 클래스 토글로 수동 전환 지원
- 관리자 대시보드는 기본 다크모드

### 글래스모피즘 효과

```css
.glass-header {
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.7);
}

.glass-panel-dark {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.07);
}
```

### 모션/애니메이션

| 효과 | 적용 |
|------|------|
| **페이지 전환** | Framer Motion `AnimatePresence` |
| **카드 터치** | `whileTap={{ scale: 0.98 }}` |
| **호출 버튼** | 펄스 애니메이션 (CSS `@keyframes`) |
| **로딩 스켈레톤** | 커스텀 `Skeleton` 컴포넌트 |
| **아코디언** | CSS `@keyframes accordion-down/up` |
| **플로팅** | `@keyframes float` (3초 무한 반복) |

### 반응형 브레이크포인트

| 브레이크포인트 | 너비 | 대상 |
|----------------|------|------|
| **모바일** | 360px~ | 고객 메뉴판, 키오스크 |
| **태블릿** | 768px~ | 관리자 대시보드 (가로형) |
| **데스크톱** | 1024px~ | 관리자 대시보드 (풀사이즈) |

### PWA (Progressive Web App)

| 기능 | 구현 |
|------|------|
| **설치 가능** | manifest.json + PWAInstallBanner |
| **오프라인 지원** | Service Worker 캐싱 |
| **업데이트 알림** | PWAUpdateNotification 컴포넌트 |
| **아이콘** | 다양한 해상도 (192x192, 512x512) |

---

## 11. 프로젝트 구조

```
wemarket-toss/250105/
├── app.js                    # Express 앱 설정, 미들웨어, 라우트 등록 (423줄)
├── index.js                  # 서버 엔트리포인트, Cron Jobs, Graceful Shutdown (117줄)
├── package.json              # 의존성 및 스크립트 정의
├── render.yaml               # Render 인프라 설정 (IaC)
├── vercel.json               # Vercel 빌드/배포 설정
├── jest.config.js            # Jest 테스트 설정
├── playwright.config.js      # Playwright E2E 테스트 설정
├── eslint.config.js          # ESLint 코드 스타일 규칙
│
├── prisma/
│   ├── schema.prisma         # DB 스키마 (50개 모델, 990줄)
│   └── migrations/           # DB 마이그레이션 히스토리
│
├── config/
│   └── prisma.js             # Prisma 클라이언트 싱글톤 인스턴스
│
├── routes/                   # API 라우트 (39개 파일)
│   ├── auth.js               # 인증 (회원가입, 로그인, OTP)
│   ├── stores.js             # 매장 CRUD, 검색, 하이라이트 (455줄)
│   ├── products.js           # 상품/메뉴 관리
│   ├── orders.js             # 주문 CRUD, 상태 관리 → orderController 위임
│   ├── payments.js           # 결제 (토스페이먼츠) (507줄)
│   ├── customers.js          # 단골 고객 관리 (417줄)
│   ├── points.js             # 포인트 시스템
│   ├── coupons.js            # 쿠폰 관리
│   ├── chat.js               # 실시간 채팅
│   ├── admin.js              # 관리자 전용 API → settlementController, storeSettingsController 위임
│   ├── analytics.js          # 매출 분석
│   ├── staff.js              # 직원 관리 (486줄)
│   ├── crm.js                # CRM 기능
│   ├── ai.js                 # AI 기능 (Gemini)
│   ├── community.js          # 커뮤니티
│   ├── reviews.js            # 리뷰
│   ├── reservations.js       # 예약
│   ├── inventory.js          # 재고 관리
│   ├── uploads.js            # 파일 업로드 (보안 가드 포함)
│   └── ...                   # 기타 20+ 라우트
│
├── controllers/              # HTTP 요청/응답 처리 (13개 파일)
│   ├── orderController.js    # 주문 관련 요청 처리
│   ├── settlementController.js # 정산 요청 처리
│   ├── storeSettingsController.js # 매장 설정 (영수증, 등급, 수수료)
│   ├── bulkSmsController.js  # Bulk SMS 발송
│   ├── authController.js     # 인증 요청 처리
│   ├── crmController.js      # CRM 요청 처리
│   ├── exportController.js   # 엑셀/PDF 내보내기
│   ├── inventoryController.js # 재고 관리
│   ├── menuOptimizationController.js # 메뉴 최적화
│   ├── notificationsController.js # 알림 관리
│   ├── notificationTemplatesController.js # 알림 템플릿
│   ├── aiAssistantController.js # AI 어시스턴트
│   └── staffGamificationController.js # 직원 게이미피케이션
│
├── services/                 # 비즈니스 로직 (18개 파일)
│   ├── OrderService.js       # 주문 비즈니스 로직 (트랜잭션, 재고, 포인트)
│   ├── PaymentService.js     # 결제 비즈니스 로직
│   ├── PointService.js       # 포인트 비즈니스 로직
│   ├── CampaignService.js    # 캠페인 자동화 (등급 승급, 쿠폰 발급)
│   ├── notificationService.js # 통합 알림 서비스 (Socket.io + FCM + DB)
│   ├── aiService.js          # Gemini AI 연동
│   ├── weeklyReportService.js # 주간 리포트 생성
│   ├── newsCollectorService.js # 뉴스 자동 수집
│   ├── LedgerService.js      # 원장 관리
│   ├── CommunityService.js   # 커뮤니티 비즈니스 로직
│   ├── printService.js       # 프린트 연동
│   ├── webhookDispatcher.js  # 웹훅 전송 + 재시도
│   └── ...                   # 기타 6+ 서비스
│
├── repositories/             # DB 접근 계층 (20개 파일)
│   ├── Store.js              # 매장 관련 DB 쿼리
│   ├── Order.js              # 주문 관련 DB 쿼리
│   ├── Product.js            # 상품 관련 DB 쿼리
│   ├── Payment.js            # 결제 관련 DB 쿼리
│   ├── StoreCustomer.js      # 고객 관련 DB 쿼리
│   ├── Point.js              # 포인트 관련 DB 쿼리
│   ├── Coupon.js             # 쿠폰 관련 DB 쿼리
│   ├── Settlement.js         # 정산 관련 DB 쿼리
│   ├── Chat.js               # 채팅 관련 DB 쿼리
│   ├── Ledger.js             # 원장 관련 DB 쿼리
│   └── ...                   # 기타 10+ 리포지토리
│
├── middleware/                # Express 미들웨어 (9개 파일)
│   ├── auth.js               # JWT 인증 (authMiddleware, optionalAuth, adminOnly)
│   ├── storeAuth.js          # 매장별 권한 검증 (checkStorePermission)
│   ├── rateLimiter.js        # API 속도 제한 (5종류)
│   ├── responseFormatter.js  # 표준 응답 포맷 (res.success, res.error)
│   ├── performanceMonitor.js # 성능 모니터링 (응답 시간 기록)
│   ├── validate.js           # Joi 요청 검증
│   ├── validator.js          # 추가 검증 유틸리티
│   ├── apiKeyAuth.js         # API 키 인증
│   └── authMiddleware.js     # Firebase 인증 미들웨어
│
├── utils/                    # 유틸리티 (22개 파일)
│   ├── errorHandler.js       # 에러 처리 (AppError, errorHandler, errorTypes)
│   ├── catchAsync.js         # 비동기 에러 래퍼
│   ├── logger.js             # Winston 로깅 설정
│   ├── notifications.js      # FCM 알림 유틸리티
│   ├── smsService.js         # SMS 발송 서비스 (Coolsms)
│   ├── i18n.js               # 다국어 미들웨어
│   ├── ssrfGuard.js          # SSRF 공격 방어 (웹훅 URL 검증)
│   ├── cache.js              # 메모리 캐싱 (node-cache, TTL 지원)
│   ├── alerting.js           # Slack 알림 시스템 (레벨별 쿨다운)
│   ├── geo.js                # 지리 좌표 계산 (하버사인 공식)
│   ├── phoneEncryption.js    # 전화번호 AES 암호화
│   ├── tokenCookies.js       # HttpOnly Cookie 관리
│   ├── toss.js               # 토스페이먼츠 API 클라이언트
│   ├── validationSchemas.js  # Joi 스키마 정의
│   └── ...                   # 기타 8+ 유틸리티
│
├── socket/
│   └── handlers.js           # Socket.io 이벤트 핸들러 (채팅, 공유장바구니, 웨이팅)
│
├── scripts/                  # 유틸리티 스크립트 (29개 파일)
│   ├── seed_production_direct.js # 프로덕션 시드 데이터
│   ├── seed_demo_full.js     # 데모 데이터 생성
│   ├── archiveLogs.js        # 로그 아카이빙 (6개월+)
│   ├── clean_duplicates.js   # 중복 데이터 정리
│   ├── generate-qrcodes.js   # QR 코드 생성
│   └── ...                   # 기타 24+ 스크립트
│
├── tests/                    # 테스트 코드
│   ├── unit/                 # 단위 테스트 (services/, models/, utils/)
│   ├── integration/          # 통합 테스트
│   ├── regression/           # 회귀 테스트
│   ├── e2e/                  # E2E 테스트 (Playwright)
│   └── scripts/              # 테스트 유틸리티
│
├── docs/
│   └── swagger.js            # Swagger API 문서 설정
│
├── frontend/                 # React 프론트엔드
│   ├── src/
│   │   ├── App.jsx           # 라우팅 설정 (403줄)
│   │   ├── main.jsx          # React 엔트리포인트
│   │   ├── index.css         # Tailwind + 시맨틱 변수 + 글래스모피즘 (468줄)
│   │   ├── pages/            # 페이지 컴포넌트 (18개)
│   │   │   ├── LandingPage.jsx       # 랜딩 (1,324줄)
│   │   │   ├── MenuPage.jsx          # 고객 메뉴판 (634줄)
│   │   │   ├── AuthPage.jsx          # 로그인/회원가입
│   │   │   ├── ProfilePage.jsx       # 프로필 (488줄)
│   │   │   ├── KitchenDisplay.jsx    # 키친 디스플레이 (339줄)
│   │   │   ├── TinkerBellManagerPage.jsx # AI 팅커벨 (514줄)
│   │   │   ├── StoreSearchPage.jsx   # 매장 검색
│   │   │   ├── MenuWorldCup.jsx      # 메뉴 월드컵 (348줄)
│   │   │   └── ...                   # 기타 9+ 페이지
│   │   ├── components/
│   │   │   ├── admin/        # 관리자 컴포넌트 (44개)
│   │   │   │   ├── MasterDashboard.jsx    # 메인 대시보드 (602줄)
│   │   │   │   ├── OrderManager.jsx       # 주문 관리
│   │   │   │   ├── MenuManager.jsx        # 메뉴 관리 (1,580줄)
│   │   │   │   ├── StoreSetupWizard.jsx   # 매장 설정 마법사 (1,472줄)
│   │   │   │   ├── StaffManager.jsx       # 직원 관리 (1,188줄)
│   │   │   │   ├── CommunityPage.jsx      # 커뮤니티 (1,079줄)
│   │   │   │   ├── TableManager.jsx       # 테이블 관리 (1,046줄)
│   │   │   │   ├── AnalyticsDashboard.jsx # 분석 대시보드 (769줄)
│   │   │   │   ├── AdminChatManager.jsx   # 관리자 채팅
│   │   │   │   ├── AdminLayout.jsx        # 관리자 레이아웃 (433줄)
│   │   │   │   └── ...                    # 기타 34+ 컴포넌트
│   │   │   ├── menu/         # 메뉴판 컴포넌트 (10개)
│   │   │   │   ├── MenuItemCard.jsx       # 메뉴 카드
│   │   │   │   ├── CartModal.jsx          # 장바구니 모달 (전체 리라이트)
│   │   │   │   ├── CartButton.jsx         # 장바구니 버튼
│   │   │   │   ├── CategoryTabs.jsx       # 카테고리 탭
│   │   │   │   ├── OptionSelectionModal.jsx # 옵션 선택 모달
│   │   │   │   ├── OrderStatusModal.jsx   # 주문 상태 모달
│   │   │   │   ├── MenuHeader.jsx         # 메뉴 헤더
│   │   │   │   ├── StoreInfoBanner.jsx    # 매장 정보 배너
│   │   │   │   ├── PersonalizedRecommendations.jsx # 개인화 추천
│   │   │   │   └── CustomerPhoneSheet.jsx # 고객 전화번호 시트
│   │   │   ├── common/       # 공통 컴포넌트 (10개)
│   │   │   │   ├── Button.jsx             # 버튼
│   │   │   │   ├── LazyImage.jsx          # 이미지 지연 로딩 (IntersectionObserver)
│   │   │   │   ├── ErrorBoundary.jsx      # 에러 경계
│   │   │   │   ├── EmptyState.jsx         # 빈 상태
│   │   │   │   ├── Skeleton.jsx           # 로딩 스켈레톤
│   │   │   │   ├── OfflineBanner.jsx      # 오프라인 배너
│   │   │   │   ├── PWAInstallBanner.jsx   # PWA 설치 배너
│   │   │   │   ├── PWAUpdateNotification.jsx # PWA 업데이트 알림
│   │   │   │   ├── LanguageSwitcher.jsx   # 언어 전환
│   │   │   │   └── NaverShareButton.jsx   # 네이버 공유
│   │   │   ├── board/         # 게시판 (BoardList, BoardDetail, BoardWrite)
│   │   │   ├── ai/            # AI 관련
│   │   │   ├── customer/      # 고객 관련 (MenuDemo)
│   │   │   └── ui/            # UI 프리미티브 (Toaster, Sonner, Tooltip 등)
│   │   ├── api/              # API 클라이언트 (17개 모듈)
│   │   │   ├── client.js     # Axios 인스턴스 설정
│   │   │   ├── auth.js       # 인증 API
│   │   │   ├── stores.js     # 매장 API
│   │   │   ├── orders.js     # 주문 API
│   │   │   ├── products.js   # 상품 API
│   │   │   ├── customers.js  # 고객 API
│   │   │   ├── admin.js      # 관리자 API
│   │   │   └── ...           # 기타 10+ 모듈
│   │   ├── hooks/            # Custom Hooks (9개)
│   │   │   ├── useAuth.jsx   # 인증 상태 관리
│   │   │   ├── useApiQuery.js # TanStack Query 래퍼
│   │   │   ├── useApi.js     # API 호출 유틸
│   │   │   ├── useTossPayment.js # 토스 결제
│   │   │   ├── useBrandPay.js # 브랜드페이
│   │   │   ├── usePoints.js  # 포인트 관리
│   │   │   ├── useKioskMode.js # 키오스크 모드
│   │   │   ├── useMotionSafe.js # 모션 감지
│   │   │   └── usePWA.js     # PWA 상태 관리
│   │   ├── contexts/         # React Context (3개)
│   │   │   ├── AuthContext.jsx    # 사용자 인증 상태
│   │   │   ├── AdminThemeContext.jsx # 관리자 테마 (다크모드)
│   │   │   └── NotificationContext.jsx # 알림 상태
│   │   ├── utils/            # 프론트엔드 유틸리티
│   │   │   ├── notificationSound.js # 하피틱 피드백 (vibrateClick, vibrateSuccess, vibrateError)
│   │   │   └── recentStores.js # 최근 방문 매장 관리
│   │   └── i18n.js           # i18next 설정
│   ├── package.json          # 프론트엔드 의존성
│   ├── vite.config.js        # Vite 빌드 설정
│   └── postcss.config.js     # PostCSS 설정
│
└── public/                   # 정적 파일
    └── ...
```

---

## 12. API 엔드포인트

### 인증 (`/api/auth`)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/api/auth/register` | 회원가입 (이메일/비밀번호) | ❌ |
| `POST` | `/api/auth/login` | 로그인 | ❌ |
| `POST` | `/api/auth/otp/send` | OTP 전화번호 인증 발송 | ❌ |
| `POST` | `/api/auth/otp/verify` | OTP 인증 확인 | ❌ |
| `POST` | `/api/auth/firebase` | Firebase 소셜 로그인 | ❌ |
| `POST` | `/api/auth/refresh` | 토큰 갱신 | ❌ |

### 매장 (`/api/stores`)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/api/stores` | 전체 매장 목록 (limit 지정 시 경량) | ❌ |
| `GET` | `/api/stores/search` | 공개 매장 검색 (지역/업종/키워드/거리순) | ❌ |
| `GET` | `/api/stores/highlights` | 지역 하이라이트 배너 | ❌ |
| `GET` | `/api/stores/my` | 내 매장 목록 | ✅ |
| `POST` | `/api/stores` | 매장 생성 | ✅ |
| `PUT` | `/api/stores/:id` | 매장 수정 | ✅ |
| `GET` | `/api/stores/:id` | 매장 상세 정보 | ❌ |

### 주문 (`/api/orders`)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/api/orders` | 주문 접수 | ❌ |
| `GET` | `/api/orders/:id` | 주문 상세 조회 | ❌ |
| `GET` | `/api/orders/store/:storeId` | 매장별 주문 목록 | ✅ |
| `PATCH` | `/api/orders/:id/status` | 주문 상태 변경 | ✅ |
| `POST` | `/api/orders/:id/cancel` | 주문 취소 | ❌ |
| `GET` | `/api/orders/customer/history` | 고객 주문 이력 | ❌ |

### 결제 (`/api/payments`)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/api/payments/confirm` | 결제 확인 (토스) | ❌ |
| `POST` | `/api/payments/refund` | 결제 환불 | ✅ |
| `GET` | `/api/payments/store/:storeId` | 매장별 결제 내역 | ✅ |

### 고객 관리 (`/api/customers`)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/api/customers/store/:storeId` | 매장별 단골 고객 목록 | ✅ |
| `GET` | `/api/customers/:phone/points` | 고객 포인트 조회 | ❌ |
| `POST` | `/api/customers/:phone/points` | 포인트 적립 | ✅ |
| `DELETE` | `/api/customers/:phone/points` | 포인트 사용 | ✅ |

### 관리자 (`/api/admin`)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/api/admin/stores/:storeId/settlements` | 정산 목록 | ✅ |
| `POST` | `/api/admin/stores/:storeId/settlements/generate` | 정산 생성 | ✅ |
| `GET` | `/api/admin/stores/:storeId/receipt-settings` | 영수증 설정 | ✅ |
| `PUT` | `/api/admin/stores/:storeId/receipt-settings` | 영수증 설정 업데이트 | ✅ |
| `GET` | `/api/admin/stores/:storeId/tier-settings` | 등급 설정 | ✅ |
| `POST` | `/api/admin/stores/:storeId/tier-settings` | 등급 설정 저장 | ✅ |
| `GET` | `/api/admin/bulk-sms/filter-options` | Bulk SMS 필터 옵션 | ✅ |
| `POST` | `/api/admin/bulk-sms/send` | Bulk SMS 발송 | ✅ |

### 분석 (`/api/analytics`)

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/api/analytics/dashboard` | 대시보드 요약 | ✅ |
| `GET` | `/api/analytics/sales` | 매출 데이터 | ✅ |
| `GET` | `/api/analytics/menu-ranking` | 메뉴별 판매 순위 | ✅ |

### 기타 주요 API

| 모듈 | 엔드포인트 | 설명 |
|------|-----------|------|
| 채팅 | `POST /api/chat/rooms` | 채팅방 생성 |
| | `GET /api/chat/rooms/:roomId/messages` | 메시지 조회 |
| 쿠폰 | `GET /api/coupons/store/:storeId` | 매장별 쿠폰 목록 |
| | `POST /api/coupons/:id/issue` | 쿠폰 발급 |
| 리뷰 | `GET /api/reviews/store/:storeId` | 매장별 리뷰 |
| | `POST /api/reviews` | 리뷰 작성 |
| 예약 | `POST /api/reservations` | 예약 신청 |
| | `GET /api/reservations/store/:storeId` | 예약 목록 |
| 재고 | `GET /api/inventory/store/:storeId` | 재고 목록 |
| | `PATCH /api/inventory/:productId/stock` | 재고 수정 |
| 직원 | `GET /api/staff/store/:storeId` | 직원 목록 |
| | `POST /api/staff` | 직원 추가 |
| 커뮤니티 | `GET /api/community/store/:storeId` | 게시물 목록 |
| | `POST /api/community` | 게시물 작성 |
| 업로드 | `POST /api/uploads/image` | 이미지 업로드 |
| 건강 체크 | `GET /api/health` | 서버 상태 |
| | `GET /api/health/deep` | DB 연결 상태 |
| 버전 | `GET /api/version` | API 버전 |

> 전체 API 문서는 서버 실행 후 `/api/docs`에서 Swagger UI로 확인할 수 있습니다.

---

## 13. 환경변수 설정

### 백엔드 (.env)

```bash
# ── Database (Supabase) ──
DATABASE_URL="postgresql://user:password@host:5432/wemarket"
DIRECT_URL="postgresql://user:password@host:5432/wemarket?schema=public"

# ── 인증 ──
JWT_SECRET="32자 이상 랜덤 문자열 (openssl rand -hex 32)"
JWT_REFRESH_SECRET="별도 랜덤 문자열"

# ── SMS (Coolsms) ──
SMS_ENV=coolsms
SMS_API_KEY="API KEY"
SMS_API_SECRET="API SECRET"
SMS_SENDER="01012345678"

# ── AI (Gemini) ──
GEMINI_API_KEY="Gemini API KEY"

# ── 결제 (Toss) ──
TOSS_CLIENT_KEY="Client KEY"
TOSS_SECRET_KEY="Secret KEY"

# ── Firebase (푸시 알림) ──
FIREBASE_API_KEY="API KEY"
FIREBASE_PROJECT_ID="Project ID"
FIREBASE_MESSAGING_SENDER_ID="Sender ID"
FIREBASE_APP_ID="App ID"
FIREBASE_SERVICE_ACCOUNT_PATH="./config/firebase-service-account.json"

# ── 서버 ──
NODE_ENV=production
PORT=5000
CORS_ORIGIN="https://wemarket.vercel.app"

# ── 알림 (Slack) ──
ALERT_WEBHOOK_URL="Slack/Discord 웹훅 URL"
ALERT_MIN_LEVEL=warn

# ── 운영 ──
SEED_KEY="시드 데이터 실행용 키"
# BYPASS_OTP=true        # 개발 중 OTP 인증 없이 회원가입 허용
# USE_HTTPONLY_COOKIE=true  # JWT를 HttpOnly Cookie로 전송
# ENABLE_DEV_OPS=true    # 개발용 엔드포인트 활성화
```

### 프론트엔드 (frontend/.env)

```bash
VITE_FIREBASE_API_KEY="API KEY"
VITE_FIREBASE_PROJECT_ID="Project ID"
VITE_FIREBASE_MESSAGING_SENDER_ID="Sender ID"
VITE_FIREBASE_APP_ID="App ID"
```

---

## 14. 지속적 배포 (CI/CD)

### 배포 파이프라인

```
코드 변경 → Git Push → 자동 감지 → 빌드 → 테스트 → 배포
                         │              │         │
                    ┌─────▼────┐   ┌─────▼────┐   │
                    │ Vercel   │   │ Render   │   │
                    │ 프론트엔드│   │ 백엔드   │   │
                    └──────────┘   └──────────┘   │
                         │              │         │
                    ┌────▼──────────────▼─────┐   │
                    │   Supabase (DB)         │   │
                    │   마이그레이션 자동 실행    │◄──┘
                    └─────────────────────────┘
```

### Vercel (프론트엔드)

| 설정 | 값 |
|------|-----|
| **빌드 명령** | `cd frontend && npm install && npm run build` |
| **출력 디렉토리** | `frontend/dist` |
| **프레임워크** | 없음 (Vite 수동 설정) |
| **SPA 라우팅** | 모든 비-API 요청을 `index.html`로 전달 |
| **자동 배포** | `main` 브랜치 푸시 시 자동 |
| **미리보기** | PR별 자동 미리보기 URL 생성 |

### Render (백엔드)

| 설정 | 값 |
|------|-----|
| **서비스 타입** | Web Service |
| **빌드** | `npm install && npx prisma generate` |
| **시작** | `node index.js` |
| **헬스체크** | `/api/health` |
| **자동 배포** | `main` 브랜치 푸시 시 자동 |
| **IaC** | `render.yaml` Blueprint로 재현 가능 |
| **시크릿** | Render 대시보드에서 수동 입력 (Git 미커밋) |

### 로컬 개발

```bash
# 1. 저장소 클론
git clone https://github.com/kwpark0047-iceu/250105.git
cd 250105

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 실제 시크릿 입력

# 3. 의존성 설치
npm install

# 4. Prisma 클라이언트 생성
npx prisma generate

# 5. DB 마이그레이션
npx prisma migrate dev

# 6. 시드 데이터 (선택)
npm run seed

# 7. 개발 서버 시작
npm run dev          # 백엔드: localhost:5000

# 8. 프론트엔드 (별도 터미널)
cd frontend
npm install
npm run dev          # 프론트엔드: localhost:5173
```

### 테스트 실행

```bash
npm run test              # 전체 테스트
npm run test:unit         # 단위 테스트
npm run test:integration  # 통합 테스트
npm run test:regression   # 회귀 테스트
npm run test:e2e          # E2E 테스트 (Playwright)
npm run test:e2e:mobile   # 모바일 E2E
npm run test:e2e:chrome   # 크롬 데스크톱 E2E
npm run test:coverage     # 커버리지 리포트
```

### 린트 실행

```bash
npm run lint:backend      # 백엔드 ESLint
cd frontend && npm run lint  # 프론트엔드 ESLint
```

### 보안 스캔

```bash
npm run security:scan           # 백엔드 Semgrep (OWASP Top 10)
npm run security:scan:frontend  # 프론트엔드 Semgrep (React)
```

---

## 라이선스 및 문의

본 프로젝트는 **WeMarket** 플랫폼의 안정성과 심미성을 극대화하기 위해 개발되었습니다.

- **저장소**: [github.com/kwpark0047-iceu/250105](https://github.com/kwpark0047-iceu/250105)
- **문의**: 저장소 [Issues](https://github.com/kwpark0047-iceu/250105/issues) 이용
- **라이선스**: ISC
