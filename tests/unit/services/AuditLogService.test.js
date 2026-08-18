jest.mock('../../../config/prisma', () => ({
  audit_logs: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
}));
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

  it('감사 로그 목록은 페이지네이션과 필터를 적용한다', async () => {
    prisma.audit_logs.count.mockResolvedValue(101);
    prisma.audit_logs.findMany.mockResolvedValue([{ id: 1, action: 'X' }]);

    const result = await AuditLogService.list({ page: 2, limit: 50, action: 'X', storeId: 3 });

    expect(prisma.audit_logs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { action: 'X', store_id: 3 },
        skip: 50,
        take: 50,
      })
    );
    expect(result.totalPages).toBe(3);
  });

  it('보존 기간 이전 로그를 삭제한다', async () => {
    prisma.audit_logs.deleteMany.mockResolvedValue({ count: 4 });

    await expect(AuditLogService.prune(30)).resolves.toEqual(
      expect.objectContaining({
        deleted: 4,
        retentionDays: 30,
      })
    );
    expect(prisma.audit_logs.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { created_at: { lt: expect.any(Date) } },
      })
    );
  });
});
