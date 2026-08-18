const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { AppError } = require('../utils/errorHandler');
const auditLogService = require('./AuditLogService');

const ASSIGNABLE_ROLES = ['staff', 'kitchen', 'manager'];

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`유효하지 않은 ${fieldName}입니다.`, 400);
  }
  return parsed;
};

const parseTime = (value, fieldName) => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new AppError(`유효하지 않은 ${fieldName}입니다.`, 400);
  }
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

class StaffService {
  async getMyRole(userId, storeId) {
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
    if (staff && staff.is_active === 0) return { role: 'user', staff_id: null };
    return { role: staff ? staff.role : 'user', staff_id: staff ? staff.id : null };
  }

  async getStaffList(storeId) {
    const staffList = await prisma.staff.findMany({
      where: { store_id: storeId },
      include: { users: { select: { id: true, name: true, email: true } } },
    });
    return staffList.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      name: s.users.name,
      email: s.users.email,
      role: s.role,
      created_at: s.created_at,
    }));
  }

  async selfRegister(userId, storeId) {
    const sid = parseInt(storeId);
    if (isNaN(sid)) throw new AppError('유효하지 않은 매장 ID입니다.', 400);

    const store = await prisma.stores.findFirst({ where: { id: sid, user_id: userId } });
    if (!store) throw new AppError('매장 소유자만 사용 가능합니다.', 403);

    const existing = await prisma.staff.findFirst({ where: { store_id: sid, user_id: userId } });
    if (existing) throw new AppError('이미 근태 추적이 활성화되어 있습니다.', 409);

    const newStaff = await prisma.staff.create({
      data: { store_id: sid, user_id: userId, role: 'owner' },
      include: { users: { select: { name: true, email: true } } },
    });
    return { id: newStaff.id, name: newStaff.users.name, role: 'owner' };
  }

  async createStaff({ storeId, name, email, password, role }, callerUserId) {
    if (!storeId || !email || !password || !name?.trim()) {
      throw new AppError('필수 정보가 누락되었습니다.', 400);
    }
    if (String(password).length < 8) throw new AppError('비밀번호는 8자 이상이어야 합니다.', 400);

    const assignedRole = role || 'staff';
    if (!ASSIGNABLE_ROLES.includes(assignedRole)) {
      throw new AppError('유효하지 않은 역할입니다.', 400);
    }

    // 매장 관리 권한 확인 (오너/매니저) — 미인증 사용자의 타 매장 직원 생성 차단
    const { getStoreRole } = require('../middleware/storeAuth');
    const myRole = await getStoreRole(callerUserId, storeId);
    if (!myRole || (myRole !== 'owner' && myRole !== 'manager')) {
      throw new AppError('직원 추가 권한이 없습니다.', 403);
    }
    if (assignedRole === 'manager' && myRole !== 'owner') {
      throw new AppError('매니저 역할은 오너만 부여할 수 있습니다.', 403);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.users.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      throw new AppError('이미 존재하는 이메일입니다.', 409);
    }

    const result = await prisma.$transaction(async (tx) => {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await tx.users.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: 'staff',
        },
      });
      const newStaff = await tx.staff.create({
        data: { store_id: parseInt(storeId), user_id: newUser.id, role: assignedRole },
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

  async getAttendance(storeId, { date, month }) {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    let clockFilter = {};
    if (date) {
      const start = new Date(date);
      if (Number.isNaN(start.getTime())) throw new AppError('유효하지 않은 날짜입니다.', 400);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      clockFilter = { clock_in: { gte: start, lt: end } };
    } else if (month) {
      const [y, m] = month.split('-').map(Number);
      if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
        throw new AppError('유효하지 않은 월입니다.', 400);
      }
      clockFilter = { clock_in: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
    }

    return prisma.staff_attendance.findMany({
      where: { store_id: storeNumber, ...clockFilter },
      include: { staff: { include: { users: { select: { name: true, email: true } } } } },
      orderBy: { clock_in: 'desc' },
    });
  }

  async clockIn(staffId, userId, userRole, note) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new AppError('직원을 찾을 수 없습니다.', 404);
    if (staff.is_active === 0) throw new AppError('비활성 직원은 출퇴근 처리할 수 없습니다.', 403);

    const isSelf = staff.user_id === userId;
    if (!isSelf && userRole !== 'super_admin') {
      const { getStoreRole } = require('../middleware/storeAuth');
      const role = await getStoreRole(userId, staff.store_id);
      if (!role || (role !== 'owner' && role !== 'manager')) {
        throw new AppError('출근 처리 권한이 없습니다.', 403);
      }
    }

    const active = await prisma.staff_attendance.findFirst({
      where: { staff_id: staffId, clock_out: null },
    });
    if (active) throw new AppError('이미 출근 중입니다.', 400);

    return prisma.staff_attendance.create({
      data: {
        staff_id: staffId,
        store_id: staff.store_id,
        clock_in: new Date(),
        note: note || null,
      },
    });
  }

  async clockOut(staffId, userId, userRole) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new AppError('직원을 찾을 수 없습니다.', 404);
    if (staff.is_active === 0) throw new AppError('비활성 직원은 출퇴근 처리할 수 없습니다.', 403);

    const isSelf = staff.user_id === userId;
    if (!isSelf && userRole !== 'super_admin') {
      const { getStoreRole } = require('../middleware/storeAuth');
      const role = await getStoreRole(userId, staff.store_id);
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
    const workHours = (clockOut - new Date(active.clock_in)) / (1000 * 60 * 60);
    return prisma.staff_attendance.update({
      where: { id: active.id },
      data: { clock_out: clockOut, work_hours: Math.round(workHours * 100) / 100 },
    });
  }

  async updateStaffRole(staffId, role, callerUserId, callerRole) {
    const target = await prisma.staff.findUnique({
      where: { id: parsePositiveInt(staffId, '직원 ID') },
    });
    if (!target) throw new AppError('직원을 찾을 수 없습니다.', 404);
    if (!ASSIGNABLE_ROLES.includes(role)) throw new AppError('유효하지 않은 역할입니다.', 400);
    if (target.role === 'owner') throw new AppError('오너 역할은 수정할 수 없습니다.', 403);

    let currentRole = callerRole;
    if (callerRole !== 'super_admin') {
      const { getStoreRole } = require('../middleware/storeAuth');
      currentRole = await getStoreRole(callerUserId, target.store_id);
      if (currentRole !== 'owner' && currentRole !== 'manager') {
        throw new AppError('직원 역할 수정 권한이 없습니다.', 403);
      }
    }
    if (role === 'manager' && currentRole !== 'owner' && currentRole !== 'super_admin') {
      throw new AppError('매니저 역할은 오너만 부여할 수 있습니다.', 403);
    }
    const updated = await prisma.staff.update({ where: { id: target.id }, data: { role } });
    void auditLogService.record({
      actorUserId: callerUserId,
      actorRole: callerRole,
      action: 'STAFF_ROLE_UPDATED',
      resourceType: 'staff',
      resourceId: target.id,
      storeId: target.store_id,
      before: { role: target.role },
      after: { role: updated.role },
    });
    return updated;
  }

  async deleteStaff(staffId, callerUserId, callerRole) {
    const target = await prisma.staff.findUnique({
      where: { id: parsePositiveInt(staffId, '직원 ID') },
    });
    if (!target) throw new AppError('직원을 찾을 수 없습니다.', 404);
    if (target.role === 'owner') throw new AppError('오너 계정은 삭제할 수 없습니다.', 403);
    if (callerRole !== 'super_admin') {
      const { getStoreRole } = require('../middleware/storeAuth');
      const currentRole = await getStoreRole(callerUserId, target.store_id);
      if (currentRole !== 'owner' && currentRole !== 'manager') {
        throw new AppError('직원 삭제 권한이 없습니다.', 403);
      }
      if (currentRole === 'manager' && target.role === 'manager') {
        throw new AppError('매니저는 다른 매니저를 삭제할 수 없습니다.', 403);
      }
    }
    const deleted = await prisma.staff.delete({ where: { id: target.id } });
    void auditLogService.record({
      actorUserId: callerUserId,
      actorRole: callerRole,
      action: 'STAFF_DELETED',
      resourceType: 'staff',
      resourceId: target.id,
      storeId: target.store_id,
      before: { role: target.role, user_id: target.user_id },
    });
    return deleted;
  }

  async lookupUser(phone, storeId, callerUserId) {
    if (!storeId) throw new AppError('매장 ID가 필요합니다.', 400);
    const { getStoreRole } = require('../middleware/storeAuth');
    const myRole = await getStoreRole(callerUserId, storeId);
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
      where: { store_id: parseInt(storeId), user_id: user.id },
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

  async addExistingUser({ storeId, userId, role }, callerUserId) {
    if (!storeId || !userId) throw new AppError('storeId와 userId가 필요합니다.', 400);

    const { getStoreRole } = require('../middleware/storeAuth');
    const myRole = await getStoreRole(callerUserId, storeId);
    if (!myRole || (myRole !== 'owner' && myRole !== 'manager')) {
      throw new AppError('직원 추가 권한이 없습니다.', 403);
    }

    const assignedRole = role || 'staff';
    if (!ASSIGNABLE_ROLES.includes(assignedRole)) {
      throw new AppError('유효하지 않은 역할입니다.', 400);
    }
    if (assignedRole === 'manager' && myRole !== 'owner') {
      throw new AppError('매니저 역할은 오너만 부여할 수 있습니다.', 403);
    }

    const existing = await prisma.staff.findFirst({
      where: { store_id: parseInt(storeId), user_id: parseInt(userId) },
    });
    if (existing) throw new AppError('이미 해당 매장의 팀원입니다.', 409);

    const newStaff = await prisma.staff.create({
      data: { store_id: parseInt(storeId), user_id: parseInt(userId), role: assignedRole },
      include: { users: { select: { name: true, email: true, phone: true } } },
    });

    return {
      id: newStaff.id,
      user_id: newStaff.user_id,
      name: newStaff.users.name,
      role: newStaff.role,
    };
  }

  async getSchedules(storeId, weekParam) {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const weekStart = weekParam ? new Date(weekParam) : new Date();
    if (Number.isNaN(weekStart.getTime()))
      throw new AppError('유효하지 않은 주 시작일입니다.', 400);
    const dayOfWeek = weekStart.getDay();
    const monday = new Date(weekStart);
    monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const schedules = await prisma.staff_schedules.findMany({
      where: { store_id: storeNumber, date: { gte: monday, lte: sunday } },
      include: {
        staff: {
          include: { users: { select: { id: true, name: true, email: true, phone: true } } },
        },
      },
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
    });

    return { schedules, week_start: monday, week_end: sunday };
  }

  async createSchedules(storeId, entries, isBatch) {
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const created = [];
    for (const entry of entries) {
      if (!entry.staff_id || !entry.date || !entry.start_time || !entry.end_time) {
        if (isBatch) continue;
        throw new AppError('staff_id, date, start_time, end_time은 필수입니다.', 400);
      }

      const entryDate = new Date(entry.date);
      if (Number.isNaN(entryDate.getTime())) {
        if (isBatch) continue;
        throw new AppError('유효하지 않은 일정 날짜입니다.', 400);
      }
      const startMinutes = parseTime(entry.start_time, '시작 시간');
      const endMinutes = parseTime(entry.end_time, '종료 시간');
      if (endMinutes <= startMinutes) {
        if (isBatch) continue;
        throw new AppError('종료 시간은 시작 시간보다 늦어야 합니다.', 400);
      }
      const assignedStaff = await prisma.staff.findUnique({
        where: { id: parsePositiveInt(entry.staff_id, '직원 ID') },
        select: { store_id: true, is_active: true },
      });
      if (
        !assignedStaff ||
        assignedStaff.store_id !== storeNumber ||
        assignedStaff.is_active === 0
      ) {
        if (isBatch) continue;
        throw new AppError('해당 매장의 활성 직원만 배정할 수 있습니다.', 400);
      }
      entryDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(entryDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const overlap = await prisma.staff_schedules.findFirst({
        where: {
          staff_id: parseInt(entry.staff_id),
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
          staff_id: parsePositiveInt(entry.staff_id, '직원 ID'),
          store_id: storeNumber,
          date: entryDate,
          start_time: entry.start_time,
          end_time: entry.end_time,
          role: entry.role || null,
          note: entry.note || null,
        },
        include: { staff: { include: { users: { select: { id: true, name: true } } } } },
      });
      created.push(schedule);
    }
    return created;
  }

  async updateSchedule(scheduleId, storeId, data) {
    const scheduleNumber = parsePositiveInt(scheduleId, '시프트 ID');
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const existing = await prisma.staff_schedules.findFirst({
      where: { id: scheduleNumber, store_id: storeNumber },
    });
    if (!existing) throw new AppError('시프트를 찾을 수 없습니다.', 404);

    const { start_time, end_time, role, note } = data;
    if (start_time !== undefined) parseTime(start_time, '시작 시간');
    if (end_time !== undefined) parseTime(end_time, '종료 시간');
    if (
      start_time !== undefined &&
      end_time !== undefined &&
      parseTime(end_time, '종료 시간') <= parseTime(start_time, '시작 시간')
    ) {
      throw new AppError('종료 시간은 시작 시간보다 늦어야 합니다.', 400);
    }
    return prisma.staff_schedules.update({
      where: { id: scheduleNumber },
      data: {
        ...(start_time && { start_time }),
        ...(end_time && { end_time }),
        ...(role !== undefined && { role }),
        ...(note !== undefined && { note }),
      },
      include: { staff: { include: { users: { select: { id: true, name: true } } } } },
    });
  }

  async deleteSchedule(scheduleId, storeId) {
    const scheduleNumber = parsePositiveInt(scheduleId, '시프트 ID');
    const storeNumber = parsePositiveInt(storeId, '매장 ID');
    const existing = await prisma.staff_schedules.findFirst({
      where: { id: scheduleNumber, store_id: storeNumber },
    });
    if (!existing) throw new AppError('시프트를 찾을 수 없습니다.', 404);
    return prisma.staff_schedules.delete({ where: { id: scheduleNumber } });
  }
}

module.exports = new StaffService();
