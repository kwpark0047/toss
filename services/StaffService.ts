import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/errorHandler';
import logger from '../utils/logger';
import type {
  StaffRole,
  StaffListItem,
  CreateStaffInput,
  AttendanceRecord,
  AttendanceQuery,
  ScheduleEntry,
  StaffSchedule,
  ScheduleUpdateData,
  UserLookupResult,
  RoleResult,
  AddExistingUserInput,
} from '../types/staff';

const prisma = new PrismaClient();
const ASSIGNABLE_ROLES: StaffRole[] = ['staff', 'kitchen', 'manager'];

class StaffService {
  async getMyRole(userId: number, storeId: number): Promise<RoleResult> {
    const store = await prisma.stores.findUnique({ where: { id: storeId } });
    if (store && store.user_id === userId) {
      const ownerStaff = await prisma.staff.findFirst({
        where: { store_id: storeId, user_id: userId },
      });
      return { role: 'owner', staff_id: ownerStaff?.id };
    }

    const staff = await prisma.staff.findUnique({
      where: { store_id_user_id: { store_id: storeId, user_id: userId } },
    });
    return { role: staff ? (staff.role as StaffRole) : 'user', staff_id: staff ? staff.id : null };
  }

  async getStaffList(storeId: number): Promise<StaffListItem[]> {
    const staffList = await prisma.staff.findMany({
      where: { store_id: storeId },
      include: { users: { select: { id: true, name: true, email: true } } },
    });

    return staffList.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      name: s.users.name,
      email: s.users.email,
      role: s.role as StaffRole,
      created_at: s.created_at,
    }));
  }

  async selfRegister(userId: number, storeId: string | number) {
    const sid = parseInt(String(storeId));
    if (isNaN(sid)) throw new AppError('유효하지 않은 매장 ID입니다.', 400);

    const store = await prisma.stores.findFirst({ where: { id: sid, user_id: userId } });
    if (!store) throw new AppError('매장 소유자만 사용 가능합니다.', 403);

    const existing = await prisma.staff.findFirst({ where: { store_id: sid, user_id: userId } });
    if (existing) throw new AppError('이미 근태 추적이 활성화되어 있습니다.', 409);

    const newStaff = await prisma.staff.create({
      data: { store_id: sid, user_id: userId, role: 'owner' },
      include: { users: { select: { name: true, email: true } } },
    });
    return { id: newStaff.id, name: newStaff.users.name, role: 'owner' as const };
  }

  async createStaff({ storeId, name, email, password, role }: CreateStaffInput) {
    if (!storeId || !email || !password || !name) {
      throw new AppError('필수 정보가 누락되었습니다.', 400);
    }

    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('이미 존재하는 이메일입니다.', 409);
    }

    const result = await prisma.$transaction(async (tx) => {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await tx.users.create({
        data: { name, email, password: hashedPassword, role: 'staff' },
      });
      const newStaff = await tx.staff.create({
        data: { store_id: parseInt(String(storeId)), user_id: newUser.id, role: (role || 'staff') as StaffRole },
        include: { users: { select: { name: true, email: true } } },
      });
      return newStaff;
    });

    return {
      id: result.id,
      user_id: result.user_id,
      name: result.users.name,
      email: result.users.email,
      role: result.role,
    };
  }

  async getAttendance(storeId: number, { date, month }: AttendanceQuery): Promise<AttendanceRecord[]> {
    let clockFilter: Record<string, any> = {};
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      clockFilter = { clock_in: { gte: start, lt: end } };
    } else if (month) {
      const [y, m] = month.split('-').map(Number);
      clockFilter = { clock_in: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
    }

    return prisma.staff_attendance.findMany({
      where: { store_id: storeId, ...clockFilter },
      include: { staff: { include: { users: { select: { name: true, email: true } } } } },
      orderBy: { clock_in: 'desc' },
    }) as Promise<AttendanceRecord[]>;
  }

  async clockIn(staffId: number, userId: number, userRole: string, note?: string) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new AppError('직원을 찾을 수 없습니다.', 404);

    const isSelf = staff.user_id === userId;
    if (!isSelf && userRole !== 'super_admin') {
      const { getStoreRole } = require('../middleware/storeAuth');
      const role: string | null = await getStoreRole(userId, staff.store_id);
      if (!role || (role !== 'owner' && role !== 'manager')) {
        throw new AppError('출근 처리 권한이 없습니다.', 403);
      }
    }

    const active = await prisma.staff_attendance.findFirst({
      where: { staff_id: staffId, clock_out: null },
    });
    if (active) throw new AppError('이미 출근 중입니다.', 400);

    return prisma.staff_attendance.create({
      data: { staff_id: staffId, store_id: staff.store_id, clock_in: new Date(), note: note || null },
    });
  }

  async clockOut(staffId: number, userId: number, userRole: string) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new AppError('직원을 찾을 수 없습니다.', 404);

    const isSelf = staff.user_id === userId;
    if (!isSelf && userRole !== 'super_admin') {
      const { getStoreRole } = require('../middleware/storeAuth');
      const role: string | null = await getStoreRole(userId, staff.store_id);
      if (!role || (role !== 'owner' && role !== 'manager')) {
        throw new AppError('퇴근 처리 권한이 없습니다.', 403);
      }
    }

    const active = await prisma.staff_attendance.findFirst({
      where: { staff_id: staffId, clock_out: null },
      orderBy: { clock_in: 'desc' },
    });
    if (!active) throw new AppError('출근 기록이 없습니다.', 400);

    const clockOut = new Date();
    const workHours = (clockOut.getTime() - new Date(active.clock_in).getTime()) / (1000 * 60 * 60);
    return prisma.staff_attendance.update({
      where: { id: active.id },
      data: { clock_out: clockOut, work_hours: Math.round(workHours * 100) / 100 },
    });
  }

  async updateStaffRole(staffId: number, role: StaffRole) {
    return prisma.staff.update({ where: { id: staffId }, data: { role } });
  }

  async deleteStaff(staffId: number) {
    return prisma.staff.delete({ where: { id: staffId } });
  }

  async lookupUser(phone: string, storeId: number | string, callerUserId: number): Promise<UserLookupResult> {
    if (!storeId) throw new AppError('매장 ID가 필요합니다.', 400);
    const { getStoreRole } = require('../middleware/storeAuth');
    const myRole: string | null = await getStoreRole(callerUserId, storeId);
    if (!myRole || (myRole !== 'owner' && myRole !== 'manager')) {
      throw new AppError('팀원 조회 권한이 없습니다.', 403);
    }

    if (!phone) throw new AppError('휴대폰 번호가 필요합니다.', 400);
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10) throw new AppError('유효한 번호를 입력해주세요.', 400);

    const user = await prisma.users.findFirst({
      where: { phone: normalized },
      select: { id: true, name: true, phone: true },
    });
    if (!user) return { found: false };

    const existing = await prisma.staff.findFirst({
      where: { store_id: parseInt(String(storeId)), user_id: user.id },
    });

    const digits = (user.phone || normalized).replace(/\D/g, '');
    const masked =
      digits.length === 11
        ? `${digits.slice(0, 3)}-****-${digits.slice(7)}`
        : `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;

    return {
      found: true,
      alreadyStaff: !!existing,
      user: { id: user.id, name: user.name || '(이름 미등록)', phone: masked },
    };
  }

  async addExistingUser({ storeId, userId, role }: AddExistingUserInput, callerUserId: number) {
    if (!storeId || !userId) throw new AppError('storeId와 userId가 필요합니다.', 400);

    const { getStoreRole } = require('../middleware/storeAuth');
    const myRole: string | null = await getStoreRole(callerUserId, storeId);
    if (!myRole || (myRole !== 'owner' && myRole !== 'manager')) {
      throw new AppError('직원 추가 권한이 없습니다.', 403);
    }

    const assignedRole = (role || 'staff') as StaffRole;
    if (!ASSIGNABLE_ROLES.includes(assignedRole)) {
      throw new AppError('유효하지 않은 역할입니다.', 400);
    }
    if (assignedRole === 'manager' && myRole !== 'owner') {
      throw new AppError('매니저 역할은 오너만 부여할 수 있습니다.', 403);
    }

    const existing = await prisma.staff.findFirst({
      where: { store_id: parseInt(String(storeId)), user_id: parseInt(String(userId)) },
    });
    if (existing) throw new AppError('이미 해당 매장의 팀원입니다.', 409);

    const newStaff = await prisma.staff.create({
      data: { store_id: parseInt(String(storeId)), user_id: parseInt(String(userId)), role: assignedRole },
      include: { users: { select: { name: true, email: true, phone: true } } },
    });

    return { id: newStaff.id, user_id: newStaff.user_id, name: newStaff.users.name, role: newStaff.role };
  }

  async getSchedules(storeId: number, weekParam?: string) {
    const weekStart = weekParam ? new Date(weekParam) : new Date();
    const dayOfWeek = weekStart.getDay();
    const monday = new Date(weekStart);
    monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const schedules = await prisma.staff_schedules.findMany({
      where: { store_id: storeId, date: { gte: monday, lte: sunday } },
      include: { staff: { include: { users: { select: { id: true, name: true, email: true, phone: true } } } } },
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
    });

    return { schedules: schedules as StaffSchedule[], week_start: monday, week_end: sunday };
  }

  async createSchedules(storeId: number, entries: ScheduleEntry[], isBatch: boolean): Promise<StaffSchedule[]> {
    const created: StaffSchedule[] = [];
    for (const entry of entries) {
      if (!entry.staff_id || !entry.date || !entry.start_time || !entry.end_time) {
        if (isBatch) continue;
        throw new AppError('staff_id, date, start_time, end_time은 필수입니다.', 400);
      }

      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(entryDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const overlap = await prisma.staff_schedules.findFirst({
        where: {
          staff_id: parseInt(String(entry.staff_id)),
          date: { gte: entryDate, lt: nextDay },
          start_time: { lt: entry.end_time },
          end_time: { gt: entry.start_time },
        },
      });

      if (overlap) {
        if (isBatch) continue;
        throw new AppError('해당 시간에 이미 등록된 시프트가 있습니다.', 409);
      }

      const schedule = await prisma.staff_schedules.create({
        data: {
          staff_id: parseInt(String(entry.staff_id)),
          store_id: storeId,
          date: entryDate,
          start_time: entry.start_time,
          end_time: entry.end_time,
          role: entry.role || null,
          note: entry.note || null,
        },
        include: { staff: { include: { users: { select: { id: true, name: true } } } } },
      });
      created.push(schedule as StaffSchedule);
    }
    return created;
  }

  async updateSchedule(scheduleId: number, storeId: number, data: ScheduleUpdateData) {
    const existing = await prisma.staff_schedules.findFirst({
      where: { id: scheduleId, store_id: storeId },
    });
    if (!existing) throw new AppError('시프트를 찾을 수 없습니다.', 404);

    const { start_time, end_time, role, note } = data;
    return prisma.staff_schedules.update({
      where: { id: scheduleId },
      data: {
        ...(start_time && { start_time }),
        ...(end_time && { end_time }),
        ...(role !== undefined && { role }),
        ...(note !== undefined && { note }),
      },
      include: { staff: { include: { users: { select: { id: true, name: true } } } } },
    });
  }

  async deleteSchedule(scheduleId: number, storeId: number) {
    const existing = await prisma.staff_schedules.findFirst({
      where: { id: scheduleId, store_id: storeId },
    });
    if (!existing) throw new AppError('시프트를 찾을 수 없습니다.', 404);
    return prisma.staff_schedules.delete({ where: { id: scheduleId } });
  }
}

export = new StaffService();
