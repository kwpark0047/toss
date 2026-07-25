const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'WeMarket QR Menu API',
            version: '1.1.0',
            description: 'WeMarket QR 메뉴 & 매장 관리 플랫폼 API 문서',
            contact: { name: 'WeMarket' },
        },
        servers: [
            { url: process.env.API_URL || 'http://localhost:3000', description: 'Development' },
            { url: 'https://wemarket-toss.onrender.com', description: 'Production' }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Firebase ID Token 또는 WeMarket 토큰'
                }
            },
            schemas: {
                Store: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        name: { type: 'string', example: '위마켓 강남점' },
                        address: { type: 'string' },
                        phone: { type: 'string' },
                        latitude: { type: 'number' },
                        longitude: { type: 'number' }
                    }
                },
                Product: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        store_id: { type: 'integer' },
                        name: { type: 'string', example: '아메리카노' },
                        price: { type: 'integer', example: 4500 },
                        category: { type: 'string', example: '음료' },
                        description: { type: 'string' },
                        is_available: { type: 'boolean' }
                    }
                },
                Order: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        store_id: { type: 'integer' },
                        order_number: { type: 'string', example: 'ORD-240101-001' },
                        status: { type: 'string', enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'] },
                        total_amount: { type: 'integer' },
                        table_number: { type: 'integer' },
                        items: { type: 'array', items: { type: 'object' } }
                    }
                },
                WaitingEntry: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        store_id: { type: 'integer' },
                        customer_name: { type: 'string' },
                        customer_phone: { type: 'string' },
                        party_size: { type: 'integer' },
                        queue_number: { type: 'integer' },
                        status: { type: 'string', enum: ['waiting', 'called', 'entered', 'cancelled'] }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' },
                        error: { type: 'string' }
                    }
                }
            }
        },
        tags: [
            { name: 'Stores', description: '매장 관리' },
            { name: 'Products', description: '상품/메뉴 관리' },
            { name: 'Orders', description: '주문 관리' },
            { name: 'Waiting', description: '대기열/웨이팅' },
            { name: 'KDS', description: '주방 디스플레이 시스템' },
            { name: 'CRM', description: '고객 관계 관리' },
            { name: 'Alimtalk', description: '카카오 알림톡' },
            { name: 'Print Jobs', description: '프린트 작업' }
        ]
    },
    apis: ['./routes/*.js'],
};

module.exports = (app) => {
    try {
        const specs = swaggerJsdoc(options);
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'WeMarket API Docs'
        }));
    } catch (e) {
        console.warn('[Swagger] 문서 생성 실패:', e.message);
    }
};
