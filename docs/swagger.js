const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'WeMarket QR Menu API',
            version: '1.0.8',
            description: 'WeMarket QR 메뉴 플랫폼 API 문서',
        },
        servers: [
            { url: process.env.API_URL || 'http://localhost:3000' }
        ],
    },
    apis: ['./routes/*.js'],
};

module.exports = (app) => {
    try {
        const specs = swaggerJsdoc(options);
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
    } catch (e) {
        console.warn('[Swagger] 문서 생성 실패:', e.message);
    }
};
