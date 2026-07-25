const AlimtalkService = require('../services/AlimtalkService');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');

/**
 * 알림톡 제어 및 전송 이력 분석 컨트롤러
 */
const alimtalkController = {
    /**
     * [GET] 특정 매장의 실시간 알림톡 전송 이력 및 비용 정산 통계 조회
     */
    getHistory: catchAsync(async (req, res) => {
        const storeId = parseInt(req.params.storeId);
        if (isNaN(storeId)) {
            throw new AppError('올바르지 않은 매장 ID 형식입니다.', 400);
        }

        const history = await AlimtalkService.getHistoryLogs(storeId);
        res.success(history, '알림톡 전송 이력 및 자금 집계가 성공적으로 조회되었습니다.');
    })
};

module.exports = alimtalkController;
