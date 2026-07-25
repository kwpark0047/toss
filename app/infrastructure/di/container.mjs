/**
 * DI Container (Awilix) - 인프라스트럭처 계층
 *
 * Clean Architecture의 의존성 주입 컨테이너 설정입니다.
 * 모든 의존성은 여기서 등록되며, 애플리케이션 계층은
 * 컨테이너에서 해석된 의존성을 받아 사용합니다.
 *
 * 사용 예:
 *   const { container } = require('./infrastructure/di/container');
 *   const useCase = container.resolve('getSystemStats');
 */

import { createContainer, asClass, asValue } from 'awilix';
import IMonitoringRepository from '../../domain/interfaces/IMonitoringRepository.mjs';
import MonitoringRepository from '../prisma/MonitoringRepository.mjs';
import GetSystemStats from '../../application/monitoring/GetSystemStats.mjs';
import GetErrorSummary from '../../application/monitoring/GetErrorSummary.mjs';

/**
 * DI 컨테이너 생성 및 등록
 * @returns {Object} awilix 컨테이너 인스턴스
 */
function createDIContainer() {
  const container = createContainer({
    injectionMode: 'PROXY', // 프로퍼티 기반 의존성 주입 (PROXY 모드)
  });

  // --- 인프라스트럭처 계층 등록 ---

  // 리포지토리 구현체 등록 (싱글톤)
  container.register({
    monitoringRepository: asClass(MonitoringRepository).singleton(),
  });

  // --- 애플리케이션 계층 등록 ---

  // Use Case 등록 (싱글톤)
  container.register({
    getSystemStats: asClass(GetSystemStats).singleton(),
    getErrorSummary: asClass(GetErrorSummary).singleton(),
  });

  // --- 도메인 인터페이스 (참조용) ---
  // 인터페이스는 직접 등록하지 않지만, 타입 검증을 위해 참조 가능
  container.register({
    IMonitoringRepository: asValue(IMonitoringRepository),
  });

  return container;
}

/**
 * Express 미들웨어: 요청별 DI 컨테이너 제공
 * @param {Object} container - awilix 컸ainer
 * @returns {Function} Express 미들웨어
 */
function diMiddleware(container) {
  return (req, res, next) => {
    // 요청 스코프 컨테이너 생성 (각 요청마다 새 인스턴스)
    req.container = container.createScope();
    next();
  };
}

export {
  createDIContainer,
  diMiddleware,
};
