const staffService = require('../services/StaffService');
const { AppError } = require('../utils/errorHandler');

const parseId = (val, name) => {
  const id = parseInt(val);
  if (isNaN(id)) throw new AppError(`유효하지 않은 ${name}입니다.`, 400);
  return id;
};

exports.getMyRole = async (req, res) => {
  const storeId = parseId(req.params.storeId, '매장 ID');
  const result = await staffService.getMyRole(req.user.id, storeId);
  res.success(result);
};

exports.getStaffList = async (req, res) => {
  const storeId = parseId(req.params.storeId, '매장 ID');
  const list = await staffService.getStaffList(storeId);
  res.success(list);
};

exports.selfRegister = async (req, res) => {
  const result = await staffService.selfRegister(req.user.id, req.body.storeId);
  res.created(result, '셀프 근태 추적이 활성화되었습니다.');
};

exports.createStaff = async (req, res) => {
  const result = await staffService.createStaff(req.body, req.user.id);
  res.created(result, '직원이 생성되었습니다.');
};

exports.getAttendance = async (req, res) => {
  const storeId = parseId(req.params.storeId, '매장 ID');
  const records = await staffService.getAttendance(storeId, req.query);
  res.success(records);
};

exports.clockIn = async (req, res) => {
  const staffId = parseId(req.params.id, '직원 ID');
  const record = await staffService.clockIn(staffId, req.user.id, req.user.role, req.body.note);
  res.created(record, '출근 처리되었습니다.');
};

exports.clockOut = async (req, res) => {
  const staffId = parseId(req.params.id, '직원 ID');
  const record = await staffService.clockOut(staffId, req.user.id, req.user.role);
  res.success(record, '퇴근 처리되었습니다.');
};

exports.updateStaffRole = async (req, res) => {
  const staffId = parseId(req.params.id, '직원 ID');
  const updated = await staffService.updateStaffRole(
    staffId,
    req.body.role,
    req.user.id,
    req.user.role
  );
  res.success(updated);
};

exports.deleteStaff = async (req, res) => {
  const staffId = parseId(req.params.id, '직원 ID');
  await staffService.deleteStaff(staffId, req.user.id, req.user.role);
  res.success({ success: true }, '직원이 삭제되었습니다.');
};

exports.lookupUser = async (req, res) => {
  const result = await staffService.lookupUser(req.query.phone, req.query.storeId, req.user.id);
  res.success(result);
};

exports.addExistingUser = async (req, res) => {
  const result = await staffService.addExistingUser(req.body, req.user.id);
  res.created(result, '팀원이 추가되었습니다.');
};

exports.getSchedules = async (req, res) => {
  const storeId = parseId(req.params.storeId, '매장 ID');
  const result = await staffService.getSchedules(storeId, req.query.week);
  res.success(result);
};

exports.createSchedules = async (req, res) => {
  const storeId = parseId(req.params.storeId, '매장 ID');
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  if (entries.length === 0) throw new AppError('등록할 일정이 없습니다.', 400);
  const created = await staffService.createSchedules(storeId, entries, Array.isArray(req.body));
  res.created({ schedules: created }, created.length + '개의 시프트가 등록되었습니다.');
};

exports.updateSchedule = async (req, res) => {
  const storeId = parseId(req.params.storeId, '매장 ID');
  const scheduleId = parseId(req.params.id, '시프트 ID');
  const updated = await staffService.updateSchedule(scheduleId, storeId, req.body);
  res.success({ schedule: updated }, '시프트가 수정되었습니다.');
};

exports.deleteSchedule = async (req, res) => {
  const storeId = parseId(req.params.storeId, '매장 ID');
  const scheduleId = parseId(req.params.id, '시프트 ID');
  await staffService.deleteSchedule(scheduleId, storeId);
  res.success(null, '시프트가 삭제되었습니다.');
};
