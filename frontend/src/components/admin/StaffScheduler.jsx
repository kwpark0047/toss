import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import { staffAPI } from '../../api/staff';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Clock, Users } from 'lucide-react';
import Icon from '../ui/Icon';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const getWeekRange = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return { monday, sunday };
};

const formatDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const ROLE_COLORS = {
  staff: 'bg-blue-100 text-blue-700 border-blue-200',
  kitchen: 'bg-orange-100 text-orange-700 border-orange-200',
  manager: 'bg-purple-100 text-purple-700 border-purple-200',
};

const ScheduleModal = ({ staffList, schedule, onSave, onDelete, onClose }) => {
  const isEdit = !!schedule?.id;
  const [staffId, setStaffId] = useState(schedule?.staff_id || '');
  const [date, setDate] = useState(schedule?.date ? formatDate(new Date(schedule.date)) : '');
  const [startTime, setStartTime] = useState(schedule?.start_time || '09:00');
  const [endTime, setEndTime] = useState(schedule?.end_time || '18:00');
  const [role, setRole] = useState(schedule?.role || '');
  const [note, setNote] = useState(schedule?.note || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!staffId || !date || !startTime || !endTime) return;
    setSaving(true);
    try {
      await onSave({
        staff_id: parseInt(staffId),
        date,
        start_time: startTime,
        end_time: endTime,
        role: role || undefined,
        note: note || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900">{isEdit ? '시프트 수정' : '시프트 등록'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">직원</label>
            <select
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              disabled={isEdit}
              required
            >
              <option value="">선택하세요</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.users?.name || '직원 #' + s.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">날짜</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              disabled={isEdit}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">시작 시간</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">종료 시간</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">역할 (선택)</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">기본 역할</option>
              <option value="staff">직원</option>
              <option value="kitchen">주방</option>
              <option value="manager">매니저</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">메모 (선택)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="특이사항"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={() => onDelete(schedule.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
              >
                <Trash2 size={16} /> 삭제
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StaffScheduler = () => {
  const { storeId } = useParams();
  const [currentWeek, setCurrentWeek] = useState(() => getWeekRange(new Date()));
  const [staffList, setStaffList] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeek.monday);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  const fetchData = useCallback(async () => {
    try {
      const weekStr = formatDate(currentWeek.monday);
      const [staffRes, scheduleRes] = await Promise.all([
        staffAPI.getByStore(storeId),
        staffAPI.getSchedules(storeId, weekStr),
      ]);
      setStaffList(staffRes || []);
      setSchedules(scheduleRes?.schedules || []);
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId, currentWeek]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const prevWeek = () => {
    const d = new Date(currentWeek.monday);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(getWeekRange(d));
  };

  const nextWeek = () => {
    const d = new Date(currentWeek.monday);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(getWeekRange(d));
  };

  const getSchedulesForDay = (staffId, date) => {
    const dateStr = formatDate(date);
    return schedules.filter(
      s => s.staff_id === staffId && formatDate(new Date(s.date)) === dateStr
    );
  };

  const handleSave = async (data) => {
    if (editSchedule?.id) {
      await staffAPI.updateSchedule(storeId, editSchedule.id, data);
      showToast('시프트가 수정되었습니다.');
    } else {
      await staffAPI.createSchedule(storeId, data);
      showToast('시프트가 등록되었습니다.');
    }
    setModalOpen(false);
    setEditSchedule(null);
    await fetchData();
  };

  const handleDelete = async (id) => {
    await staffAPI.deleteSchedule(storeId, id);
    showToast('시프트가 삭제되었습니다.');
    setModalOpen(false);
    setEditSchedule(null);
    await fetchData();
  };

  const totalHours = (s) => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    return (eh * 60 + em - (sh * 60 + sm)) / 60;
  };

  const weeklyHoursByStaff = {};
  schedules.forEach(s => {
    if (!weeklyHoursByStaff[s.staff_id]) weeklyHoursByStaff[s.staff_id] = 0;
    weeklyHoursByStaff[s.staff_id] += totalHours(s);
  });

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 토스트 */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">근무표</h2>
          <p className="text-sm text-slate-500">주간 직원 스케줄 관리</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm">
            <button onClick={prevWeek} className="p-2.5 hover:bg-slate-50 rounded-l-xl transition-colors">
              <ChevronLeft size={18} className="text-slate-500" />
            </button>
            <span className="px-4 py-2.5 text-sm font-medium text-slate-700 min-w-[140px] text-center border-x border-slate-100">
              {formatDate(currentWeek.monday)} ~ {formatDate(currentWeek.sunday)}
            </span>
            <button onClick={nextWeek} className="p-2.5 hover:bg-slate-50 rounded-r-xl transition-colors">
              <ChevronRight size={18} className="text-slate-500" />
            </button>
          </div>
          <button
            onClick={() => { setEditSchedule(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            <Plus size={16} /> 시프트 추가
          </button>
        </div>
      </div>

      {/* 요일 컬럼 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* 헤더 행 */}
        <div className="grid grid-cols-[160px_repeat(7,1fr)_80px] border-b border-slate-200 bg-slate-50">
          <div className="p-3 text-sm font-semibold text-slate-600 border-r border-slate-200">직원</div>
          {weekDays.map((d, i) => (
            <div
              key={i}
              className={`p-3 text-center border-r border-slate-200 last:border-r-0 ${
                d.getDay() === 0 || d.getDay() === 6 ? 'bg-red-50/50' : ''
              }`}
            >
              <div className="text-xs font-medium text-slate-400">{DAY_NAMES[d.getDay()]}</div>
              <div className="text-sm font-bold text-slate-700">{d.getDate()}</div>
            </div>
          ))}
          <div className="p-3 text-center">
            <Clock size={16} className="text-slate-400 mx-auto" />
          </div>
        </div>

        {/* 직원별 행 */}
        {staffList.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Icon icon="Users" />
            <p className="font-medium">등록된 직원이 없습니다.</p>
            <p className="text-xs mt-1">먼저 직원을 추가해주세요.</p>
          </div>
        ) : (
          staffList.map((staff) => (
            <div key={staff.id} className="grid grid-cols-[160px_repeat(7,1fr)_80px] border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors">
              <div className="p-3 flex items-center gap-2 border-r border-slate-100">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                  {staff.users?.name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 leading-tight">
                    {staff.users?.name || '알 수 없음'}
                  </p>
                  {staff.role && (
                    <span className="text-[10px] text-slate-400">{staff.role}</span>
                  )}
                </div>
              </div>

              {weekDays.map((d, di) => {
                const daySchedules = getSchedulesForDay(staff.id, d);
                return (
                  <div
                    key={di}
                    className={`p-2 min-h-[72px] border-r border-slate-100 last:border-r-0 cursor-pointer hover:bg-blue-50/30 transition-colors ${
                      d.getDay() === 0 || d.getDay() === 6 ? 'bg-red-50/30' : ''
                    }`}
                    onClick={() => {
                      setEditSchedule(null);
                      setModalOpen(true);
                    }}
                  >
                    <div className="space-y-1">
                      {daySchedules.map((s) => (
                        <div
                          key={s.id}
                          className={`px-2 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                            ROLE_COLORS[s.role] || ROLE_COLORS.staff
                          } hover:opacity-80`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditSchedule(s);
                            setModalOpen(true);
                          }}
                        >
                          <span>{s.start_time}-{s.end_time}</span>
                          {s.note && <span className="ml-1 opacity-60">· {s.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="p-3 flex items-center justify-center text-sm font-medium text-slate-600">
                {weeklyHoursByStaff[staff.id]?.toFixed(1) || 0}h
              </div>
            </div>
          ))
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="font-medium">범례:</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200" /> 직원</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-200" /> 주방</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-100 border border-purple-200" /> 매니저</span>
        <span className="text-slate-300">|</span>
        <span>셀을 클릭하여 시프트 추가</span>
      </div>

      {/* 모달 */}
      {modalOpen && (
        <ScheduleModal
          staffList={staffList}
          schedule={editSchedule}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setModalOpen(false); setEditSchedule(null); }}
        />
      )}
    </div>
  );
};

export default StaffScheduler;
