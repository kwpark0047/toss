module.exports = async () => {
    // 회귀/단위 테스트: supertest(app) 방식으로 동작 → 서버 기동 불필요
    // app.js만 import하여 Express 앱 객체를 가져옴 (포트 점유 없음)
    process.env.NODE_ENV = 'test';
    global.__SERVER__ = null;
};
