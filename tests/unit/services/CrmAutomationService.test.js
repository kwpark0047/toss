jest.mock('../../../config/prisma', () => ({
  store_customers: { findMany: jest.fn() },
  crm_campaign_runs: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('../../../utils/phoneEncryption', () => ({ decryptPhone: jest.fn(() => '01012345678') }));
jest.mock('../../../utils/smsService', () => ({
  sendSms: jest.fn().mockResolvedValue({ sent: true }),
}));

const prisma = require('../../../config/prisma');
const service = require('../../../services/CrmAutomationService');

describe('CrmAutomationService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('세그먼트 대상 수를 계산하고 승인 대기 캠페인을 생성한다', async () => {
    prisma.store_customers.findMany.mockResolvedValue([
      {
        customer_phone: 'enc',
        last_visit_at: new Date(),
        visit_count: 1,
        total_spent: 1000,
      },
    ]);
    prisma.crm_campaign_runs.create.mockResolvedValue({ id: 1, status: 'pending' });

    const result = await service.generate(3, {
      segmentName: 'New',
      message: '다음 방문 혜택입니다.',
    });

    expect(result.status).toBe('pending');
    expect(prisma.crm_campaign_runs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ store_id: 3, segment_name: 'New', target_count: 1 }),
      })
    );
  });

  it('승인되지 않은 캠페인은 발송할 수 없다', async () => {
    prisma.crm_campaign_runs.findFirst.mockResolvedValue({ id: 1, store_id: 3, status: 'pending' });

    await expect(service.send(1, 3)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('이미 처리된 캠페인은 다시 결정할 수 없다', async () => {
    prisma.crm_campaign_runs.findFirst.mockResolvedValue({ id: 1, store_id: 3, status: 'sent' });

    await expect(service.decide(1, 3, 'rejected', 7)).rejects.toMatchObject({ statusCode: 409 });
  });
});
