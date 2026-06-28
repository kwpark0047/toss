require('dotenv').config();
const { httpServer } = require('./app');

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`[서버] WeMarket API 서버 실행 중: http://localhost:${PORT}`);
    console.log(`[환경] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[버전] v1.0.9 - 코드베이스 분석 및 버그 수정 완료`);
});
