jest.mock('../../../config/prisma', () => ({
  $queryRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
}));
jest.mock('../../../services/StoreManagerService', () => class StoreManagerService {});

const db = require('../../../config/prisma');
const BusinessSupportService = require('../../../services/BusinessSupportService');

describe('BusinessSupportService trial gates', () => {
  beforeEach(() => jest.clearAllMocks());

  function setupOwnerStore() {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 8, user_id: 7, is_active: true }]),
      $executeRawUnsafe: jest.fn(),
    };
    db.$transaction.mockImplementation((operation) => operation(tx));
    db.$queryRawUnsafe.mockImplementation(async (sql) =>
      sql.includes('business_access_status')
        ? [{ business_access_status: 'approved', trial_ends_at: null }]
        : [{ id: 8, user_id: 7, is_active: true }]
    );
    return tx;
  }

  test('expired owner cannot enable AI support or create a background job', async () => {
    const tx = setupOwnerStore();
    db.$queryRawUnsafe.mockImplementation(async (sql) =>
      sql.includes('business_access_status')
        ? [{ business_access_status: 'trialing', trial_ends_at: new Date(Date.now() - 60_000) }]
        : [{ id: 8, user_id: 7, is_active: true }]
    );

    await expect(
      new BusinessSupportService(db).enroll(8, { id: 7, role: 'user' }, true)
    ).rejects.toMatchObject({ statusCode: 403, code: 'TRIAL_EXPIRED' });
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  test('suspended owner cannot read AI support data', async () => {
    setupOwnerStore();
    db.$queryRawUnsafe.mockImplementation(async (sql) =>
      sql.includes('business_access_status')
        ? [{ business_access_status: 'suspended', trial_ends_at: null }]
        : [{ id: 8, user_id: 7, is_active: true }]
    );

    await expect(
      new BusinessSupportService(db).enrollment(8, { id: 7, role: 'user' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'BUSINESS_ACCOUNT_SUSPENDED' });
  });
});

