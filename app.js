const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// 커스텀 미들웨어 및 유틸리티
const responseFormatter = require('./middleware/responseFormatter');
const { errorHandler } = require('./utils/errorHandler');
const { i18nMiddleware, SUPPORTED_LANGUAGES: _SUPPORTED_LANGUAGES } = require('./utils/i18n');
const performanceMonitor = require('./middleware/performanceMonitor');
const Monitoring = require('./models/Monitoring');

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
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://frontend-gamma-ten-89.vercel.app',
    'https://wemarket-toss.onrender.com',
    'https://wemarket.onrender.com',
    'https://wemarket.vercel.app'
];

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
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.gstatic.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://www.gstatic.com"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: [
                "'self'",
                "http://localhost:3000",
                "ws://localhost:3000",
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
app.use(responseFormatter);
app.use(i18nMiddleware);
app.use(performanceMonitor);

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
 * API 초기 진단 엔드포인트 (최우선 순위)
 */
app.get("/api/health", async (req, res) => {
    let dbStatus = "unknown";
    try {
        const prisma = require('./config/prisma');
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = "connected";
    } catch (e) {
        dbStatus = `error: ${e.message}`;
    }
    res.json({
        status: "ok",
        db: dbStatus,
        timestamp: new Date().toISOString(),
        version: '1.0.8-final-complete-v3'
    });
});

// 버전/디버그 엔드포인트 (개발 환경에서만 상세 정보 노출)
app.get('/api/version', (req, res) => {
    const info = {
        version: '1.0.8-final-complete-v3',
        environment: process.env.NODE_ENV || 'production'
    };
    if (process.env.NODE_ENV !== 'production') {
        info.deployedAt = new Date().toISOString();
        info.message = 'Direct DB Connection Verification Active';
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
            version: '1.0.8-final-mega'
        });
    });
}

// Firebase 설정은 프론트엔드 VITE env 변수로 직접 주입 (개발 환경에서만 API 확인용)
if (process.env.NODE_ENV !== 'production') {
    app.get("/api/config/firebase", (req, res) => {
        res.json({
            apiKey: process.env.FIREBASE_API_KEY,
            projectId: process.env.FIREBASE_PROJECT_ID,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID
        });
    });
}

if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/list', (req, res) => {
        res.json({ ok: true, env: process.env.NODE_ENV });
    });
    app.get('/api/debug/routes', (req, res) => {
        const list = [];
        const router = app.router || app._router;
        if (router) {
            router.stack.forEach((layer) => {
                if (layer.route) {
                    list.push({
                        path: layer.route.path,
                        methods: Object.keys(layer.route.methods),
                    });
                } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
                    const mountPath = typeof layer.path === 'string' ? layer.path : '(mounted)';
                    layer.handle.stack.forEach((sub) => {
                        if (sub.route) {
                            list.push({
                                path: mountPath + sub.route.path,
                                methods: Object.keys(sub.route.methods),
                            });
                        }
                    });
                }
            });
        }
        res.json({ routes: list, count: list.length });
    });
}

// [보안/동적] Firebase Messaging Service Worker를 환경변수 기반으로 동적 생성하여 제공
app.get("/firebase-messaging-sw.js", (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    const script = `
        importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
        importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

        firebase.initializeApp({
            apiKey: "${process.env.FIREBASE_API_KEY || ''}",
            projectId: "${process.env.FIREBASE_PROJECT_ID || ''}",
            messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}",
            appId: "${process.env.FIREBASE_APP_ID || ''}"
        });

        const messaging = firebase.messaging();
    `;
    res.send(script);
});

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
    uploads: require('./routes/uploads'),
    crm: require('./routes/crm'),
    menuOptimization: require('./routes/menuOptimization'),
    staffGamification: require('./routes/staffGamification'),
    aiAssistant: require('./routes/aiAssistant'),
    export: require('./routes/export'),
    inventory: require('./routes/inventory')
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

app.use(`${API_PREFIX}/auth`, (req, res, next) => {
    if (req.method === 'POST' && req.path === '/send-otp') {
        return res.json({ diag: true, path: req.path, baseUrl: req.baseUrl, originalUrl: req.originalUrl });
    }
    next();
});
app.use(`${API_PREFIX}/auth`, routes.auth);
app.use(`${API_PREFIX}/stores`, routes.stores);
app.use(`${API_PREFIX}/products`, routes.products);
app.use(`${API_PREFIX}/orders`, routes.orders);
app.use(`${API_PREFIX}/tables`, routes.tables);
app.use(`${API_PREFIX}/payments`, routes.payments);
app.use(`${API_PREFIX}/notifications`, routes.notifications);
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

io.on('connection', (socket) => {
    console.log(`[Socket] 클라이언트 연결됨: ${socket.id}`);
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
    socket.on('disconnect', () => console.log(`[Socket] 클라이언트 연결 해제됨: ${socket.id}`));

    // --- [채팅 관련 소켓 이벤트] ---
    // 채팅방 참여
    socket.on('join-chat-room', ({ roomId }) => {
        socket.join(`chat - ${roomId}`);
        console.log(`[Socket] 채팅방 입장: chat - ${roomId}`);
    });

    // 메시지 전송
    socket.on('send-chat-message', (data) => {
        const { roomId, message } = data;
        // 해당 방의 다른 모든 이에게 메시지 전달 (매니저/고객)
        io.to(`chat - ${roomId}`).emit('new-chat-message', message);

        // 매니저 알림 (매장 채널로 이벤트 브로드캐스트)
        if (message.sender_type === 'customer') {
            io.to(`store - ${data.storeId}`).emit('manager-notification', {
                type: 'CHAT_RECEPTION',
                message: '새로운 고객 메시지가 도착했습니다.',
                roomId: roomId
            });
        }
    });

    // 호출 알림 (매니저 호출 버튼 클릭 시)
    socket.on('manager-call', (data) => {
        const { storeId, tableName, type } = data;
        io.to(`store - ${storeId}`).emit('manager-notification', {
            type: 'MANAGER_CALL',
            message: `${tableName || '고객'}님이 매니저를 호출하셨습니다. (${type})`,
            tableName
        });
    });

    // --- [공유 장바구니 관련 소켓 이벤트] ---
    // 테이블 장바구니 룸 참여
    socket.on('join-table-cart', ({ tableId }) => {
        socket.join(`table - cart - ${tableId}`);
        console.log(`[Socket] 테이블 공유 장바구니 입장: table - cart - ${tableId}`);
    });

    // 장바구니 업데이트 브로드캐스트
    socket.on('update-shared-cart', (data) => {
        const { tableId, item, userPhone, action } = data;
        // 같은 테이블 인원들에게 업데이트 전파
        io.to(`table - cart - ${tableId}`).emit('cart-item-updated', {
            item,
            userPhone,
            action // 'add', 'update', 'remove', 'clear'
        });
    });

    // --- [고객 주문 실시간 알림 채널] ---
    // 핸드폰 번호로 phone-join 후 구독 (주문 상태 변경 실시간 수신)
    socket.on('join-customer-orders', ({ phone }) => {
        const normalized = phone.replace(/[^0-9]/g, '');
        socket.join(`customer-orders-${normalized}`);
        console.log(`[Socket] 고객 주문 알림 채널 입장: customer-orders-${normalized}`);
    });

    // --- [스마트 웨이팅 관련 소켓 이벤트] ---
    // 특정 매장의 대기 관리 채널 참여 (관리자/직원용)
    socket.on('join-store-waiting', ({ storeId }) => {
        socket.join(`store - waiting - ${storeId}`);
        console.log(`[Socket] 매장 대기 관리 채널 입장: store - waiting - ${storeId}`);
    });

    // 내 대기 상태 추적 채널 참여 (고객용)
    socket.on('join-my-waiting', ({ phone }) => {
        socket.join(`customer - waiting - ${phone}`);
        console.log(`[Socket] 개인 대기 추적 채널 입장: customer - waiting - ${phone}`);
    });

    // 대기 상태 변경 알림 (동기화)
    socket.on('update-waiting-status', (data) => {
        const { storeId, phone, status, entry } = data;

        // 1. 매장 전체 대기 리스트 갱신 (관리자 앱)
        io.to(`store - waiting - ${storeId}`).emit('waiting-list-changed', { storeId });

        // 2. 개별 고객에게 상태 변경 통보 (입장 호출 등)
        io.to(`customer - waiting - ${phone}`).emit('waiting-status-changed', {
            status,
            entry,
            message: status === 'called' ? '입장해 주세요! 점원이 기다리고 있습니다.' : '대기 상태가 업데이트되었습니다.'
        });

        // 3. 해당 매장 대기 중인 모든 고객에게 '내 앞 대기 팀' 숫자 갱신용 이벤트 전송
        io.to(`store - waiting - ${storeId}`).emit('refresh-ahead-count');
    });
});

// 알림 서비스 초기화 (Socket.io 인스턴스 주입)
notificationService.init(io);

app.set('io', io);

// Swagger API 문서
require('./docs/swagger')(app);

// 404 핸들러 (매칭되는 라우트가 없을 경우 상세 로깅 및 응답 보장)
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.error(`[CRITICAL 404] Unmatched API Path: ${req.method} ${req.originalUrl}`);
        console.error(`[Headers]`, JSON.stringify(req.headers, null, 2));

        return res.status(404).json({
            success: false,
            message: `요청하신 API 경로를 찾을 수 없습니다: ${req.method} ${req.originalUrl}.`,
            diagnostics: {
                version: '1.0.8-final-mega',
                hint: '서버 라우터에 해당 경로가 정의되지 않았거나 매칭 실패했습니다. app.js 등록 순서를 확인하십시오.'
            },
            timestamp: new Date().toISOString()
        });
    }
    next();
});

// 에러 핸들러 (반드시 모든 라우트 등록 후 마지막에 위치)
app.use(errorHandler);

module.exports = { app, io, httpServer };

