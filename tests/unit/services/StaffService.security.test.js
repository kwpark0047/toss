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
  users: { findUnique: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require('../../../config/prisma');
const staffService = require('../../../services/StaffService');

describe('StaffService account security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.stores.findUnique.mockResolvedValue({ user_id: 1 });
    prisma.staff.findFirst.mockResolvedValue(null);
  });

  it('매니저는 직원을 다시 매니저로 승격할 수 없다', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 2, store_id: 3, role: 'staff', is_active: 1 });
    prisma.stores.findUnique.mockResolvedValue({ user_id: 99 });
    prisma.staff.findFirst.mockResolvedValue({ role: 'manager', is_active: 1 });

    await expect(staffService.updateStaffRole(2, 'manager', 7, 'manager')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(prisma.staff.update).not.toHaveBeenCalled();
  });

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
