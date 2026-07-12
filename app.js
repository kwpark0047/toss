const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// 환경변수 검증
const { checkEnv } = require('./utils/envValidator');
const envCheck = checkEnv();
if (!envCheck.ok) {
  console.error('서버 시작 불가 — 위 환경변수를 .env 파일에 설정하세요.');
  process.exit(1);
}

// 커스텀 미들웨어 및 유틸리티
const responseFormatter = require('./middleware/responseFormatter');
const { errorHandler } = require('./utils/errorHandler');
const { i18nMiddleware, SUPPORTED_LANGUAGES: _SUPPORTED_LANGUAGES } = require('./utils/i18n');
const performanceMonitor = require('./middleware/performanceMonitor');
const Monitoring = require('./repositories/Monitoring');
const { generalLimiter, orderLimiter, authLimiter, paymentLimiter } = require('./middleware/rateLimiter');
const alerting = require('./utils/alerting');
const healthRouter = require('./routes/health');
const { requestTracker } = require('./routes/health');

// 앱 버전 단일 소스: package.json (엔드포인트 간 불일치 방지)
const APP_VERSION = require('./package.json').version;

// 글로벌 미처리 예외 알림 등록
alerting.registerGlobalHandlers();

// [수정] 모든 모델은 이제 Prisma 기반으로 통달되었으므로 레거시 DB 연결 및 직접 모델 로드 제거
// require('./config/database');
// require('./models/User');

const app = express();
const httpServer = createServer(app);

// 알림 서비스 인스턴스
const notificationService = require('./services/notificationService');

/**
 * CORS 설정
 */
const isProduction = process.env.NODE_ENV === 'production';
// 프로덕션 허용 오리진 (배포 도메인만). localhost는 개발 환경에서만 추가한다.
const allowedOrigins = [
    'https://frontend-gamma-ten-89.vercel.app',
    'https://wemarket-toss.onrender.com',
    'https://wemarket.onrender.com',
    'https://wemarket.vercel.app',
    'https://250105.vercel.app'
];
// 프로덕션에서 localhost 오리진은 CORS 목록에서 전면 제외 (공격 표면 제거)
if (!isProduction) {
    allowedOrigins.push(
        'http://localhost:3000',
        'http://localhost:3002',
        'http://localhost:5173',
        'http://localhost:5174'
    );
}

if (process.env.CORS_ORIGIN) {
    process.env.CORS_ORIGIN.split(',').forEach(origin => {
        if (!allowedOrigins.includes(origin.trim())) {
            allowedOrigins.push(origin.trim());
        }
    });
}

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600
}));

/**
 * 보안 헤더 및 기본 미들웨어
 */
// 보안 헤더 설정
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://www.gstatic.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://www.gstatic.com"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
                "'self'",
                ...(isProduction ? [] : ["http://localhost:3000", "ws://localhost:3000"]),
                "https://wemarket.onrender.com",
                "wss://wemarket.onrender.com",
                "https://wemarket-toss.onrender.com",
                "https://api.tosspayments.com",
                "https://www.googleapis.com",
                "https://firebaseinstallations.googleapis.com",
                "https://fcmregistrations.googleapis.com"
            ],
            frameSrc: ["'self'", "https://js.tosspayments.com"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use((req, res, next) => {
    // 추가적인 커스텀 헤더 설정 (helmet이 덮어쓰지 않는 경우)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

app.use(express.json());

// HttpOnly Cookie 기반 인증 (USE_HTTPONLY_COOKIE=true 시 활성화)
app.use(require('cookie-parser')());

app.use(responseFormatter);
app.use(i18nMiddleware);
app.use(performanceMonitor);
app.use(requestTracker);        // SLA 지표 수집
app.use('/api', generalLimiter); // 전체 API 속도 제한

/**
 * API 모니터링 (가장 먼저 시작)
 */
app.use((req, res, next) => {
    if (req.path.startsWith('/api') && !req.path.includes('/monitoring/metrics')) {
        const startTime = Date.now();
        res.on('finish', () => {
            const responseTime = Date.now() - startTime;
            setImmediate(() => {
                try {
                    Monitoring.Metrics.record({
                        endpoint: req.path,
                        method: req.method,
                        response_time: responseTime,
                        status_code: res.statusCode,
                        store_id: req.storeId || null,
                        user_id: req.user?.id || null
                    });
                } catch (_e) {
                    const logger = require('./utils/logger');
                    logger.warn(`[Monitoring] 기록 실패: ${req.path}`, { error: _e.message });
                }
            });
        });
    }
    next();
});

/**
 * API 라우트 등록 (정적 파일보다 우선순위 높임)
 */
/**
 * 헬스체크 & SLA 모니터링 엔드포인트
 */
app.use('/api/health', healthRouter);

// ── 운영 편의 엔드포인트 (시드/DB push) ────────────────────────────────────
// 임의 명령 실행을 노출하므로 프로덕션에서는 기본 비활성. 한시적으로 필요할 때만
// ENABLE_DEV_OPS=true 로 켠다. 라우터 내부에서 SEED_KEY 인증을 강제한다.
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OPS) {
    app.use('/api/_devops', require('./routes/_devOps'));
    require('./utils/logger').warn('[app] 운영 편의 엔드포인트(/api/_devops) 활성화됨');
}

// 버전 엔드포인트 — package.json 단일 소스에서 읽어 불일치 방지
app.get('/api/version', (req, res) => {
    const info = {
        version: APP_VERSION,
        environment: process.env.NODE_ENV || 'production'
    };
    if (process.env.NODE_ENV !== 'production') {
        info.deployedAt = new Date().toISOString();
    }
    res.json(info);
});

if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/system', (req, res) => {
        res.json({
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version,
            timestamp: new Date().toISOString(),
            version: APP_VERSION
        });
    });
}

// Firebase 설정 API - Service Worker가 fetch하여 초기화 (CSP/XSS 리스크 완화)
// env 값을 JS에 직접 삽입하지 않고 런타임 Fetch로 가져옴
app.get("/api/config/firebase", (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY || '',
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.FIREBASE_APP_ID || ''
    });
});

// Firebase Messaging Service Worker는 public/firebase-messaging-sw.js로 분리 (CSP 안전)

// (버전 및 시스템 엔드포인트 최상단으로 이동됨)

const routes = {
    auth: require('./routes/auth'),
    stores: require('./routes/stores'),
    products: require('./routes/products'),
    orders: require('./routes/orders'),
    tables: require('./routes/tables'),
    payments: require('./routes/payments'),
    notifications: require('./routes/notifications'),
    categories: require('./routes/categories'),
    admin: require('./routes/admin'),
    points: require('./routes/points'),
    planRequests: require('./routes/planRequests'),
    staffRequests: require('./routes/staffRequests'),
    optionTemplates: require('./routes/optionTemplates'),
    boards: require('./routes/boards'),
    ai: require('./routes/ai'),
    analytics: require('./routes/analytics'),
    chat: require('./routes/chat'),
    cart: require('./routes/cart'),
    waiting: require('./routes/waiting'),
    reviews: require('./routes/reviews'),
    customers: require('./routes/customers'),
    coupons: require('./routes/coupons'),
    reservations: require('./routes/reservations'),
    staff: require('./routes/staff'),
    notificationTemplates: require('./routes/notificationTemplates'),
    uploads: require('./routes/uploads'),
    crm: require('./routes/crm'),
    menuOptimization: require('./routes/menuOptimization'),
    staffGamification: require('./routes/staffGamification'),
    aiAssistant: require('./routes/aiAssistant'),
    export: require('./routes/export'),
    inventory: require('./routes/inventory'),
    community: require('./routes/community'),
    legal: require('./routes/legal'),
    naverPlace: require('./routes/naverPlace'),
    foodTrucks: require('./routes/foodTrucks'),
    kds: require('./routes/kds'),
    alimtalk: require('./routes/alimtalk')
};

// [DEBUG] API 요청 도달 모니터링 (라우트 매칭 전 상세 로깅, 개발 환경에서만 활성화)
if (process.env.NODE_ENV !== 'production') {
    app.use('/api', (req, res, next) => {
        const logger = require('./utils/logger');
        logger.debug(`[API Trace] ${req.method} ${req.originalUrl}`);
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            logger.debug(`[API Body]`, JSON.stringify(req.body, null, 2));
        }
        next();
    });
}

// [API 라우트 명시적 그룹화 등록]
const API_PREFIX = '/api';

// ── Open Commerce Hub: 개발자 포털(내부 인증) + Open API v1(API 키 인증) ──
app.use(`${API_PREFIX}/developer`, require('./routes/developer'));
app.use(`${API_PREFIX}/v1`, require('./routes/v1'));

app.use(`${API_PREFIX}/auth`, authLimiter, routes.auth);
app.use(`${API_PREFIX}/stores`, routes.stores);
app.use(`${API_PREFIX}/products`, routes.products);
app.use(`${API_PREFIX}/orders`, orderLimiter, routes.orders);
app.use(`${API_PREFIX}/tables`, routes.tables);
app.use(`${API_PREFIX}/payments`, paymentLimiter, routes.payments);
app.use(`${API_PREFIX}/notifications`, routes.notifications);
app.use(`${API_PREFIX}/notification-templates`, routes.notificationTemplates);
app.use(`${API_PREFIX}/categories`, routes.categories);
app.use(`${API_PREFIX}/admin`, routes.admin);
app.use(`${API_PREFIX}/points`, routes.points);
app.use(`${API_PREFIX}/plan-requests`, routes.planRequests);
app.use(`${API_PREFIX}/staff-requests`, routes.staffRequests);
app.use(`${API_PREFIX}/staff`, routes.staff);
app.use(`${API_PREFIX}/boards`, routes.boards);
app.use(`${API_PREFIX}/ai`, routes.ai);
app.use(`${API_PREFIX}/analytics`, routes.analytics);
app.use(`${API_PREFIX}/chat`, routes.chat);
app.use(`${API_PREFIX}/cart`, routes.cart);
app.use(`${API_PREFIX}/waiting`, routes.waiting);
app.use(`${API_PREFIX}/reviews`, routes.reviews);
app.use(`${API_PREFIX}/customers`, routes.customers);
app.use(`${API_PREFIX}/option-templates`, routes.optionTemplates);
app.use(`${API_PREFIX}/coupons`, routes.coupons);
app.use(`${API_PREFIX}/reservations`, routes.reservations);
app.use(`${API_PREFIX}/uploads`, routes.uploads);
app.use(`${API_PREFIX}/crm`, routes.crm);
app.use(`${API_PREFIX}/menu-optimization`, routes.menuOptimization);
app.use(`${API_PREFIX}/staff-gamification`, routes.staffGamification);
app.use(`${API_PREFIX}/ai-assistant`, routes.aiAssistant);
app.use(`${API_PREFIX}/export`, routes.export);
app.use(`${API_PREFIX}/inventory`, routes.inventory);
app.use(`${API_PREFIX}/community`, routes.community);
app.use(`${API_PREFIX}/legal`, routes.legal);
app.use(`${API_PREFIX}/naver-place`, routes.naverPlace);
app.use(`${API_PREFIX}/foodtruck`, routes.foodTrucks);
app.use(`${API_PREFIX}/kds`, routes.kds);
app.use(`${API_PREFIX}/alimtalk`, routes.alimtalk);

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// SPA 라우팅 지원: 모든 비 API 요청을 index.html로 전송
app.get('/{*path}', (req, res, next) => {
    // API 요청이나 정적 파일 요청(확장자가 있는 경우)은 통과
    if (req.path.startsWith('/api') || req.path.includes('.')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        credentials: true
    }
});

const logger = require('./utils/logger');
const { registerSocketHandlers } = require('./socket/handlers');

io.on('connection', (socket) => {
    logger.debug(`[Socket] 연결됨: ${socket.id}`);
    socket.on('join-order', (orderId) => socket.join(`order - ${orderId}`));
    socket.on('join-store', (data) => {
        const storeId = typeof data === 'object' ? data.storeId : data;
        const userId = typeof data === 'object' ? data.userId : null;
        socket.join(`store - ${storeId}`);
        if (userId) socket.join(`user - ${userId}`);
    });
    socket.on('join-kitchen', ({ storeId, userId }) => {
        socket.join(`kitchen - ${storeId}`);
        if (userId) socket.join(`user - ${userId}`);
    });
    socket.on('join-admin', (userId) => {
        if (userId) socket.join(`user - ${userId}`);
        socket.join('admin');
        logger.debug(`[Socket] 관리자 입장: ${socket.id}`);
    });
    socket.on('disconnect', () => logger.debug(`[Socket] 연결 해제됨: ${socket.id}`));
});

// 채팅/공유장바구니/웨이팅 핸들러 (분리된 모듈)
registerSocketHandlers(io);

// 알림 서비스 초기화 (Socket.io 인스턴스 주입)
notificationService.init(io);

app.set('io', io);

// Swagger API 문서
require('./docs/swagger')(app);

// CORS 안전망 - 라우트 매칭 전에 실패해도 CORS 헤더 보장
app.use((req, res, next) => {
    const origin = req.headers.origin;
    // 사유: origin을 allowedOrigins 화이트리스트로 검증한 뒤에만 반사하므로 임의 오리진 허용 아님
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin); // nosemgrep: javascript.express.security.cors-misconfiguration.cors-misconfiguration
        res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '3600');
        return res.sendStatus(204);
    }
    next();
});

// 404 핸들러 (매칭되는 라우트가 없을 경우 상세 로깅 및 응답 보장)
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.error(`[CRITICAL 404] Unmatched API Path: ${req.method} ${req.originalUrl}`);
        return res.status(404).json({
            success: false,
            message: `요청하신 API 경로를 찾을 수 없습니다: ${req.method} ${req.originalUrl}.`,
            timestamp: new Date().toISOString()
        });
    }
    next();
});

// 에러 핸들러 (반드시 모든 라우트 등록 후 마지막에 위치)
app.use(errorHandler);

module.exports = { app, io, httpServer };

