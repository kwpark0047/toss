const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const router = express.Router();

// Swagger 정의
const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WeMarket API',
      version: process.env.npm_package_version || '1.3.0',
      description: `
# WeMarket QR Menu & Small Business Platform API

## 개요
소상공인을 위한 QR 메뉴 주문, 결제, 대기열 관리, AI 추천을 통합한 SaaS 플랫폼입니다.

## 주요 기능
- **QR 메뉴/주문**: 테이블별 QR 코드로 비대면 주문
- **통합 결제**: 현금/카드/계좌이체/간편결제(토스/카카오/네이버) + 포인트
- **대기열/예약**: 웨이팅 등록, 알림톡, 분할결제
- **AI 추천**: 날씨/시간/선호도 기반 메뉴 추천
- **동적 가격**: 시간/수요/날씨/재고 기반 자동 가격 조정
- **CRM/마케팅**: 고객 세그먼트, 캠페인, 알림톡
- **주방/프린팅**: KDS, ESC/POS 프린터, 알림톡 연동

## 인증
- **Bearer Token**: JWT (Access/Refresh)
- **API Key**: 개발자 포털용 (X-API-Key 헤더)
- **Order Capability**: 고객 주문 전용 토큰 (x-order-capability)

## Rate Limiting
| 엔드포인트 | 제한 |
|---|---|
| 인증 | 10 req/min |
| 주문/결제 | 30 req/min |
| 일반 API | 100 req/min |

## 웹훅
- Toss Payments 결제 알림
- 알림톡 발송 결과
- 주문 상태 변경 (Socket.IO)

## 배포
- **Backend**: https://wemarket.onrender.com
- **Frontend**: https://toss.wemarket.workers.dev
`,
      contact: {
        name: 'WeMarket Team',
        email: 'support@wemarket.kr',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      { url: 'https://wemarket.onrender.com/api', description: 'Production' },
      { url: 'http://localhost:3000/api', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
        orderCapability: {
          type: 'apiKey',
          in: 'header',
          name: 'x-order-capability',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            details: { type: 'object' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    },
    tags: [
      { name: 'Auth', description: '인증/인가 (로그인, 회원가입, 토큰 갱신)' },
      { name: 'Stores', description: '매장 관리 (CRUD, 설정, 테마, QR)' },
      { name: 'Products', description: '상품/메뉴 관리 (카테고리, 옵션, 이미지)' },
      { name: 'Orders', description: '주문 생성/조회/상태변경/취소/통계' },
      { name: 'Payments', description: '결제 생성/승인/취소/부분취소/분할결제' },
      { name: 'Points', description: '포인트 적립/사용/내역/스토어 설정' },
      { name: 'Waiting', description: '대기열 등록/조회/알림/취소' },
      { name: 'Reservations', description: '예약 등록/조회/변경/취소' },
      { name: 'AI/ML', description: '메뉴 추천, 날씨 연동, 수요 예측, 동적 가격' },
      { name: 'Analytics', description: '매출/상품/직원/다중매장 통계' },
      { name: 'Notifications', description: '알림톡/푸시/시스템 알림 템플릿 관리' },
      { name: 'KDS', description: '주방 디스플레이 시스템 (주문 접수/진행/완료)' },
      { name: 'Admin', description: '슈퍼어드민/매장어드민 대시보드' },
      { name: 'Config', description: '프론트엔드 설정 (Firebase 등)' },
      { name: 'Health', description: '헬스체크/시스템 상태' },
    ],
  },
  apis: ['./routes/*.js', './controllers/*.js'],
};

const specs = swaggerJsdoc(options);

// Swagger UI 옵션
const uiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #4f46e5; font-size: 2rem; }
    .swagger-ui .scheme-container { background: #f8fafc; border-radius: 8px; padding: 1rem; }
  `,
  customSiteTitle: 'WeMarket API Docs',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
  },
};

router.use('/', swaggerUi.serve, swaggerUi.setup(specs, uiOptions));

// JSON 스펙 엔드포인트
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

module.exports = router;
