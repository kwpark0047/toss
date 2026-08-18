// StaffService 테스트 — 직원 생성 보안(매장 권한·역할 제약)
jest.mock('../../../config/prisma', () => ({
  users: { findUnique: jest.fn(), create: jest.fn() },
  staff: { findFirst: jest.fn(), create: jest.fn() },
  stores: { findUnique: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require('../../../config/prisma');
const StaffService = require('../../../services/StaffService');

const OWNER_ID = 1;
const STORE_ID = 42;

describe('StaffService.createStaff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 오너 (호출자 == 가게 주인)
    prisma.stores.findUnique.mockResolvedValue({ user_id: OWNER_ID });
    prisma.staff.findFirst.mockResolvedValue(null);
  });

  it('오너는 직원을 생성하고 기본 역할(staff)을 부여한다', async () => {
    prisma.users.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
    prisma.users.create.mockResolvedValue({ id: 100, name: '신입', email: 'new@test.com' });
    prisma.staff.create.mockResolvedValue({
      id: 1,
      user_id: 100,
      store_id: STORE_ID,
      role: 'staff',
      users: { name: '신입', email: 'new@test.com' },
    });

    const result = await StaffService.createStaff(
      {
        storeId: STORE_ID,
        name: '신입',
        email: 'new@test.com',
        password: 'pass1234',
        role: 'staff',
      },
      OWNER_ID
    );

    expect(result.role).toBe('staff');
    expect(result.email).toBe('new@test.com');
    expect(prisma.users.create).toHaveBeenCalled();
  });

  it('매장 멤버가 아닌 사용자(타 매장)의 직원 생성은 거부된다 (403)', async () => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 999 }); // 호출자 != 오너

    await expect(
      StaffService.createStaff(
        { storeId: STORE_ID, name: '신입', email: 'new@test.com', password: 'pass1234' },
        OWNER_ID
      )
    ).rejects.toThrow('권한이 없습니다');
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it('매니저가 매니저 역할 직원을 생성하려면 거부된다 (403, 오너 전용)', async () => {
    // 호출자는 매니저
    prisma.stores.findUnique.mockResolvedValue({ user_id: 999 });
    prisma.staff.findFirst.mockResolvedValue({
      store_id: STORE_ID,
      user_id: OWNER_ID,
      role: 'manager',
      is_active: 1,
    });

    await expect(
      StaffService.createStaff(
        {
          storeId: STORE_ID,
          name: '대리',
          email: 'mgr@test.com',
          password: 'pass1234',
          role: 'manager',
        },
        OWNER_ID
      )
    ).rejects.toThrow('오너만');
  });

  it('유효하지 않은 역할은 거부된다 (400)', async () => {
    await expect(
      StaffService.createStaff(
        {
          storeId: STORE_ID,
          name: '신입',
          email: 'new@test.com',
          password: 'pass1234',
          role: 'ceo',
        },
        OWNER_ID
      )
    ).rejects.toThrow('유효하지 않은 역할');
  });

  it('중복 이메일은 거부된다 (409)', async () => {
    prisma.users.findUnique.mockResolvedValue({ id: 7, email: 'dup@test.com' });

    await expect(
      StaffService.createStaff(
        { storeId: STORE_ID, name: '신입', email: 'dup@test.com', password: 'pass1234' },
        OWNER_ID
      )
    ).rejects.toThrow('이미 존재');
    expect(prisma.staff.create).not.toHaveBeenCalled();
  });
});
