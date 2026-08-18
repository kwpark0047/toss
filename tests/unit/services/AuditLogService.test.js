jest.mock('../../../config/prisma', () => ({ audit_logs: { create: jest.fn() } }));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn() }));

const prisma = require('../../../config/prisma');
const AuditLogService = require('../../../services/AuditLogService');

describe('AuditLogService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('민감정보를 마스킹해 감사 로그를 기록한다', async () => {
    prisma.audit_logs.create.mockResolvedValue({ id: 1 });

    await AuditLogService.record({
      actorUserId: 7,
      actorRole: 'manager',
      action: 'STAFF_ROLE_UPDATED',
      resourceType: 'staff',
      resourceId: 3,
      after: { role: 'staff', phone: '01012345678', nested: { token: 'secret' } },
    });

    expect(prisma.audit_logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          after_data: { role: 'staff', phone: '[REDACTED]', nested: { token: '[REDACTED]' } },
        }),
      })
    );
  });

  it('감사 로그 실패가 업무 결과를 실패시키지 않는다', async () => {
    prisma.audit_logs.create.mockRejectedValue(new Error('database down'));

    await expect(AuditLogService.record({ action: 'X', resourceType: 'Y' })).resolves.toBeNull();
  });
});
