const axios = require('axios');
const logger = require('./logger');

/**
 * Render Free Tier 서버 슬립 방지용 자가 핑 데몬
 */
const startKeepAlive = (selfUrl) => {
    // 테스트 환경 또는 로컬 개발 환경에서는 자가 핑 비활성화 (오류 방지 및 자원 보존)
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
        return;
    }

    const url = selfUrl || process.env.SELF_URL || 'https://wemarket.onrender.com';
    const intervalMs = 10 * 60 * 1000; // 10분 간격

    logger.info(`[Keep-Alive] Render Free Tier 슬립 방지 자가 핑 데몬이 성공적으로 가동되었습니다. 대상: ${url}`);

    setInterval(async () => {
        try {
            const res = await axios.get(`${url}/api/health`, {
                headers: {
                    'User-Agent': 'WeMarket-KeepAlive-Daemon'
                },
                timeout: 15000 // 15초 타임아웃
            });
            logger.info(`[Keep-Alive] 자가 헬스체크 핑 전송 성공: Status ${res.status}`);
        } catch (err) {
            logger.warn(`[Keep-Alive] 자가 헬스체크 핑 전송 실패 (서버 슬립 여부 확인 필요): ${err.message}`);
        }
    }, intervalMs);
};

module.exports = { startKeepAlive };
