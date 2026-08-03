const logger = require('../utils/logger');

class DashboardBroadcastService {
  /**
   * @param {import('socket.io').Server} io
   */
  init(io) {
    this.io = io;
    logger.info('[DashboardBroadcastService] Initialized with Socket.IO');
  }

  /**
   * 실시간 대시보드 데이터를 클라이언트(관리자/가맹점주)에게 브로드캐스팅합니다.
   * @param {number|string} storeId - 매장 ID (특정 매장 대시보드만 업데이트할 때)
   * @param {string} event - 이벤트명 (예: 'dashboard_update')
   * @param {Object} data - 전송할 데이터
   */
  broadcastToStore(storeId, event, data) {
    if (!this.io) {
      logger.warn('[DashboardBroadcastService] Socket.io is not initialized.');
      return;
    }
    const room = `store_${storeId}_dashboard`;
    this.io.to(room).emit(event, data);
    logger.debug(`[DashboardBroadcastService] Broadcast to ${room}: ${event}`);
  }

  /**
   * 주문 상태 변경 시 대시보드 업데이트 알림
   * @param {number|string} storeId 
   * @param {Object} orderInfo 
   */
  notifyOrderChange(storeId, orderInfo) {
    this.broadcastToStore(storeId, 'order_status_changed', orderInfo);
  }

  /**
   * AI 추천 또는 수요 예측 결과 업데이트 알림
   * @param {number|string} storeId 
   * @param {Object} forecastData 
   */
  notifyForecastUpdate(storeId, forecastData) {
    this.broadcastToStore(storeId, 'forecast_updated', forecastData);
  }
}

module.exports = new DashboardBroadcastService();
