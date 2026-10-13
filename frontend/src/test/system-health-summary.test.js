import { test, expect } from 'vitest';
import { systemHealthSummary } from '../lib/systemHealthSummary';
test('missing data and failed refresh cannot claim normal or actual outage', () => {
  expect(systemHealthSummary(null).tone).toBe('unknown');
  expect(systemHealthSummary({ status: 'ok' }, true).tone).toBe('unknown');
});
test('configuration warning is distinguished from an actual database outage', () => {
  const health = {
    status: 'degraded',
    checks: {
      database: { status: 'ok' },
      memory: { status: 'ok' },
      tossPayments: { status: 'ok' },
      operationalConfig: { status: 'warn' },
      omniroute: { status: 'unavailable' },
    },
  };
  expect(systemHealthSummary(health)).toEqual({ tone: 'warn', title: '운영 필수 설정 확인 필요' });
  health.checks.database.status = 'error';
  expect(systemHealthSummary(health).tone).toBe('error');
});
