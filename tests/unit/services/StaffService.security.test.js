jest.mock('../../../config/prisma', () => ({
  stores: { findUnique: jest.fn(), findFirst: jest.fn() },
  staff: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  staff_attendance: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  staff_schedules: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  users: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  $queryRawUnsafe: jest
    .fn()
    .mockResolvedValue([{ business_access_status: 'approved', trial_ends_at: null }]),
  $transaction: jest.fn(),
}));
jest.mock('../../../utils/planQuota', () => ({
  assertPlanQuota: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../../config/prisma');
const staffService = require('../../../services/StaffService');

describe('StaffService account security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.stores.findUnique.mockResolvedValue({ user_id: 1 });
    prisma.staff.findFirst.mockResolvedValue(null);
    prisma.$queryRawUnsafe.mockResolvedValue([
      { business_access_status: 'approved', trial_ends_at: null },
    ]);
  });

  it.each(['staff', 'manager', 'kitchen'])(
    '매니저는 %s 계정 역할을 변경할 수 없다',
    async (role) => {
      prisma.staff.findUnique.mockResolvedValue({
        id: 2,
        store_id: 3,
        role: 'staff',
        is_active: 1,
      });
      prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
      prisma.staff.findFirst.mockResolvedValue({ role: 'manager', is_active: 1 });

      await expect(staffService.updateStaffRole(2, role, 7, 'manager')).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(prisma.staff.update).not.toHaveBeenCalled();
    }
  );

  it.each(['staff', 'manager', 'kitchen'])('매니저는 신규 %s 계정을 만들 수 없다', async (role) => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    prisma.staff.findFirst.mockResolvedValue({ role: 'manager', is_active: 1 });

    await expect(
      staffService.createStaff(
        {
          storeId: 3,
          name: '팀원',
          email: 'team@example.com',
          password: 'pass12345',
          role,
        },
        7,
        'staff'
      )
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it.each(['staff', 'manager', 'kitchen'])('매니저는 %s 계정을 추가할 수 없다', async (role) => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    prisma.staff.findFirst.mockResolvedValueOnce({ role: 'manager', is_active: 1 });

    await expect(
      staffService.addExistingUser({ storeId: 3, userId: 8, role }, 7)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.staff.create).not.toHaveBeenCalled();
  });

  it.each(['staff', 'manager', 'kitchen'])(
    '사업자 오너는 %s 계정을 추가할 수 있다',
    async (role) => {
      prisma.stores.findUnique.mockResolvedValue({ user_id: 1 });
      prisma.staff.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
      prisma.staff.count = jest.fn().mockResolvedValue(0);
      prisma.staff.create.mockResolvedValue({
        id: 20,
        user_id: 8,
        role,
        users: { name: '팀원', email: 'team@example.com', phone: null },
      });

      await expect(
        staffService.addExistingUser({ storeId: 3, userId: 8, role }, 1)
      ).resolves.toMatchObject({ role });
    }
  );

  it('오너는 비활성화했던 기존 계정을 요금제 한도 검사 후 복구할 수 있다', async () => {
    prisma.stores.findUnique.mockResolvedValue({ user_id: 1 });
    prisma.staff.findFirst.mockResolvedValue({ id: 20, user_id: 8, is_active: 0 });
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.staff.update.mockResolvedValue({
      id: 20,
      user_id: 8,
      role: 'kitchen',
      users: { name: '팀원' },
    });

    await expect(
      staffService.addExistingUser({ storeId: 3, userId: 8, role: 'kitchen' }, 1)
    ).resolves.toMatchObject({ id: 20, role: 'kitchen' });
    expect(prisma.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 20 },
        data: { role: 'kitchen', is_active: 1 },
      })
    );
  });

  it('매니저는 일반 직원도 매장에서 삭제할 수 없다', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 2, store_id: 3, role: 'staff', user_id: 8 });
    prisma.stores.findUnique.mockResolvedValue({ user_id: 1 });
    prisma.staff.findFirst.mockResolvedValue({ role: 'manager', is_active: 1 });

    await expect(staffService.deleteStaff(2, 7, 'manager')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(prisma.staff.delete).not.toHaveBeenCalled();
  });

  it.each(['staff', 'manager', 'kitchen'])(
    '사업자 오너는 %s 계정의 매장 접근을 삭제할 수 있다',
    async (role) => {
      prisma.staff.findUnique.mockResolvedValue({ id: 2, store_id: 3, role, user_id: 8 });
      prisma.stores.findUnique.mockResolvedValue({ user_id: 1 });
      prisma.staff.update.mockResolvedValue({ id: 2 });

      await expect(staffService.deleteStaff(2, 1, 'owner')).resolves.toEqual({ id: 2 });
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { is_active: 0 },
      });
    }
  );

  it('승격 가능한 역할 목록 밖의 role을 거부한다', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 2, store_id: 3, role: 'staff', is_active: 1 });

    await expect(staffService.updateStaffRole(2, 'super_admin', 1, 'owner')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(prisma.staff.update).not.toHaveBeenCalled();
  });

  it('비활성 직원은 출퇴근할 수 없다', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 2, user_id: 7, store_id: 3, is_active: 0 });

    await expect(staffService.clockIn(2, 7, 'staff')).rejects.toMatchObject({ statusCode: 403 });
    await expect(staffService.clockOut(2, 7, 'staff')).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.staff_attendance.create).not.toHaveBeenCalled();
  });

  it('체험 종료 후에는 직원의 출퇴근 쓰기도 차단한다', async () => {
    prisma.staff.findUnique.mockResolvedValue({
      id: 2,
      user_id: 7,
      store_id: 3,
      role: 'staff',
      is_active: 1,
    });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        business_access_status: 'trialing',
        trial_ends_at: new Date(Date.now() - 60_000),
      },
    ]);

    await expect(staffService.clockIn(2, 7, 'staff')).rejects.toMatchObject({
      statusCode: 403,
      code: 'TRIAL_EXPIRED',
    });
    await expect(staffService.clockOut(2, 7, 'staff')).rejects.toMatchObject({
      statusCode: 403,
      code: 'TRIAL_EXPIRED',
    });
    expect(prisma.staff_attendance.create).not.toHaveBeenCalled();
  });

  it('다른 매장의 직원을 스케줄에 배정할 수 없다', async () => {
    prisma.staff.findUnique.mockResolvedValue({ store_id: 99, is_active: 1 });

    await expect(
      staffService.createSchedules(
        3,
        [
          {
            staff_id: 2,
            date: '2026-08-20',
            start_time: '09:00',
            end_time: '18:00',
          },
        ],
        false
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.staff_schedules.create).not.toHaveBeenCalled();
  });

  it('시작보다 빠른 종료 시간은 거부한다', async () => {
    await expect(
      staffService.createSchedules(
        3,
        [
          {
            staff_id: 2,
            date: '2026-08-20',
            start_time: '18:00',
            end_time: '09:00',
          },
        ],
        false
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.staff.findUnique).not.toHaveBeenCalled();
  });

  it('오너 직원 레코드는 삭제할 수 없다', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 2, store_id: 3, role: 'owner', is_active: 1 });

    await expect(staffService.deleteStaff(2, 1, 'owner')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(prisma.staff.delete).not.toHaveBeenCalled();
  });
});

