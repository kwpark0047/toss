/**
 * Metric - 도메인 엔티티
 *
 * 시스템 성능 메트릭을 나타내는 도메인 엔티티입니다.
 * 인프라스트럭처 계층의 데이터베이스 모델과 분리되어 있습니다.
 */

class Metric {
  /**
   * @param {Object} params
   * @param {string} params.endpoint - API 엔드포인트
   * @param {string} params.method - HTTP 메서드
   * @param {number} params.response_time - 응답 시간 (ms)
   * @param {number} params.status_code - HTTP 상태 코드
   * @param {number|null} params.store_id - 매장 ID
   * @param {number|null} params.user_id - 사용자 ID
   * @param {Date} params.timestamp - 기록 시간
   */
  constructor({ endpoint, method, response_time, status_code, store_id = null, user_id = null, timestamp = new Date() }) {
    this.endpoint = endpoint;
    this.method = method;
    this.response_time = response_time;
    this.status_code = status_code;
    this.store_id = store_id;
    this.user_id = user_id;
    this.timestamp = timestamp;
  }

  /**
   * 정상 응답인지 확인 (2xx 상태 코드)
   * @returns {boolean}
   */
  isSuccess() {
    return this.status_code >= 200 && this.status_code < 300;
  }

  /**
   * 느린 응답인지 확인 (기본 임계치: 100ms)
   * @param {number} thresholdMs - 임계치 (ms)
   * @returns {boolean}
   */
  isSlow(thresholdMs = 100) {
    return this.response_time >= thresholdMs;
  }

  /**
   * 도메인 엔티티를 데이터베이스 입력 형식으로 변환
   * @returns {Object}
   */
  toPersistence() {
    return {
      endpoint: this.endpoint,
      method: this.method,
      response_time: parseInt(this.response_time),
      status_code: parseInt(this.status_code),
      store_id: this.store_id ? parseInt(this.store_id) : null,
      user_id: this.user_id ? parseInt(this.user_id) : null,
    };
  }
}

export default Metric;
