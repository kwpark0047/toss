# WeMarket — Database Schema

> Prisma ORM · PostgreSQL 16 · Supabase
> 전체 53개 모델 (prisma/schema.prisma)

## Enum

```
OrderStatus         pending | confirmed | preparing | ready | completed | cancelled
OrderPaymentStatus  pending | paid | failed | refunded
PaymentTxStatus     pending | READY | DONE | CANCELED | PARTIAL_CANCELED
```

## 핵심 모델

### stores (매장)
```
id                    Int          PK
user_id               Int          FK → users
name                  String
address               String?
phone                 String?
plan                  String?      default "free"
business_number       String?      사업자등록번호
business_name         String?      법인명
ceo_name              String?      대표자
commission_rate       Float?       default 0.03
settlement_cycle      String?      MONTHLY|WEEKLY|DAILY|MANUAL
is_active             Boolean?     default true
```

### products (상품)
```
id                    Int          PK
store_id              Int          FK → stores
category_id           Int?         FK → categories
name                  String
price                 Int
image_url             String?
is_active             Boolean?     default true
is_sold_out           Boolean?     default false
stock_quantity        Int?         null=무제한
options               String?      JSON
nutrition_info        String?      영양정보
allergens             String?      알레르기
detail_images         String?      JSON
```

### orders (주문)
```
id                    Int           PK
store_id              Int           FK → stores
table_id              Int?          FK → tables
order_number          String        UNIQUE
customer_name         String?
customer_phone        String?
customer_fcm_token    String?
status                OrderStatus   default pending
method                String?       payment method
payment_status        OrderPaymentStatus default pending
total_amount          Int?          default 0
queue_number          Int?
order_type            String?       dine_in|takeout|delivery
is_split_payment      Boolean?      default false
split_type            String?       NONE|EQUAL|ITEM
split_status          String?       default "PENDING"
notes                 String?
```
- 인덱스: `(store_id, status, created_at)`, `(customer_phone)`, `(table_id)`

### order_items (주문 항목)
```
id                    Int          PK
order_id              Int          FK → orders
product_id            Int?         FK → products
product_name          String
price                 Int
quantity              Int
subtotal              Int
options               String?      JSON
user_phone            String?      분할결제 정산용
```

### payments (결제)
```
id                    Int           PK
order_id              Int           FK → orders
store_id              Int           FK → stores
status                PaymentTxStatus default pending
amount                Int
payment_key           String?
toss_transaction_id   String?       UNIQUE
method                String?       카드|간편결제
order_name            String?
receipt_url           String?
checkout_url          String?
is_partial            Boolean?      default false
point_amount          Int?          default 0
cash_amount           Int?          default 0
refunded_amount       Int?          default 0
```
- Partial unique index: `(order_id) WHERE status='READY'` (1개만 허용)
- 인덱스: `(store_id, status, created_at)`

### categories (카테고리)
```
id                    Int          PK
store_id              Int          FK → stores
name                  String
sort_order            Int?         default 0
```

### customers → store_customers (매장별 고객)
```
id                    Int          PK
store_id              Int          FK → stores
customer_name         String?
customer_phone        String
toss_user_key         String?
fcm_token             String?      FCM 푸시 토큰
visit_count           Int          default 1
total_spent           Int          default 0
tier                  String       default "GENERAL"
```
- Unique: `(store_id, customer_phone)`

### user_points (포인트)
```
id                    Int          PK
user_id               Int?         FK → users
toss_user_key         String?      UNIQUE
phone                 String?
total_points          Int?         default 0
lifetime_earned       Int?         default 0
lifetime_used         Int?         default 0
```

### point_transactions (포인트 내역)
```
id                    Int          PK
user_point_id         Int          FK → user_points
store_id              Int          FK → stores
order_id              Int?
payment_id            Int?
type                  String       적립/사용/소멸
amount                Int
balance_after         Int
description           String?
expires_at            DateTime?
```

### coupons (쿠폰)
```
id                    Int          PK
store_id              Int          FK → stores
name                  String
type                  String
amount                Int
min_order_amount      Int          default 0
valid_days            Int          default 30
is_active             Int          default 1
```

### staff (직원)
```
id                    Int          PK
store_id              Int          FK → stores
user_id               Int          FK → users
role                  String?      staff|kitchen|manager
pin_code              String?      PIN 인증
is_active             Int?         default 1
```

### reviews (리뷰)
```
id                    Int          PK
store_id              Int          FK → stores
order_id              Int?         UNIQUE
customer_name         String?
customer_phone        String?
rating                Int          default 5
content               String
image_url             String?
reply                 String?      점주 답글
```

### tables (테이블)
```
id                    Int          PK
store_id              Int          FK → stores
table_number          String
qr_code               String       UNIQUE
is_active             Boolean?     default true
capacity              Int?         default 2
status                String?      available|occupied
```

### notifications (알림)
```
id                    Int          PK
store_id              Int          FK → stores
type                  String       NEW_ORDER|ORDER_STATUS|LOW_STOCK|...
title                 String
message               String
data                  String?      JSON
is_read               Boolean      default false
priority              String       low|normal|high|urgent
link                  String?
```

### waiting_list (대기열)
```
id                    Int          PK
store_id              Int          FK → stores
customer_name         String?
customer_phone        String
party_size            Int          default 1
status                String       default "waiting"
queue_number          Int
```

### settlements (정산)
```
id                    Int          PK
store_id              Int          FK → stores
period_start          DateTime
period_end            DateTime
total_sales           Int?         default 0
commission_amount     Int?         수수료 합계
net_amount            Int?         점주 수취액
status                String?      PENDING|COMPLETED|PAID|CANCELLED
tax_invoice_number    String?      세금계산서 번호
```

### stores ↔ 관계 요약
```
stores 1─N categories
stores 1─N products
stores 1─N orders 1─N order_items
stores 1─N orders 1─N payments 1─N point_transactions
stores 1─N reviews
stores 1─N staff
stores 1─N tables
stores 1─N waiting_list
stores 1─N notifications
stores 1─N store_customers
stores 1─N coupons
stores 1─N settlements
stores 1─N ledger
stores 1─1 store_accounts
stores 1─1 store_point_settings
stores 1─1 store_receipt_settings
stores 1─1 food_trucks
```

## 인덱스 전략
- 복합 인덱스: `(store_id, status, created_at)` — 주문 조회
- 복합 인덱스: `(store_id, category_id, is_active)` — 상품 필터
- Partial unique: `(order_id) WHERE status='READY'` — 중복 결제 방지
- 모든 FK에 인덱스 존재
- `created_at DESC` 인덱스로 최신순 정렬 최적화
