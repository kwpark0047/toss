export function systemHealthSummary(health, unavailable = false) {
  if (!health || unavailable)
    return { tone: 'unknown', title: '시스템 상태를 확인하지 못했습니다' };
  const checks = health.checks || {};
  const core = ['database', 'memory', 'tossPayments'].map((key) => checks[key]?.status);
  if (core.some((status) => ['error', 'circuit_open', 'OPEN'].includes(status))) {
    return { tone: 'error', title: '핵심 시스템 장애 감지' };
  }
  if (core.includes('warn')) return { tone: 'warn', title: '핵심 시스템 성능 점검 필요' };
  if (checks.operationalConfig?.status === 'warn')
    return { tone: 'warn', title: '운영 필수 설정 확인 필요' };
  if (health.status === 'ok') return { tone: 'ok', title: '핵심 시스템 정상 운영 중' };
  return { tone: 'warn', title: '일부 시스템 상태 점검 필요' };
}
