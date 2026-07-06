import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { staffAPI, storesAPI } from '../../api';
import { formatTime } from '../../utils/format';
import { handleApiError } from '../../utils/apiError';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Edit2, Trash2, Users, ChefHat,
  UserCheck, User, Clock, Calendar, BarChart2, LogIn, LogOut,
  Sparkles, Check, X, AlertCircle, RefreshCw, Zap,
  QrCode, Wifi, Timer, Phone, Search, UserPlus, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';

// ── 역할 정의 ──────────────────────────────────────────────
const ROLES = {
  owner:   { label: '오너',   color: 'bg-amber-500',   text: 'text-amber-400',   border: 'border-amber-500/30',   icon: Sparkles,  perms: ['전체 관리', '직원 관리', '통계', '정산', '메뉴', '주문'] },
  manager: { label: '매니저', color: 'bg-blue-500',    text: 'text-blue-400',    border: 'border-blue-500/30',    icon: UserCheck, perms: ['직원 관리', '통계', '메뉴', '주문'] },
  staff:   { label: '직원',   color: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: User,      perms: ['주문 처리'] },
  kitchen: { label: '주방',   color: 'bg-orange-500',  text: 'text-orange-400',  border: 'border-orange-500/30',  icon: ChefHat,   perms: ['주문 확인'] },
};

const TABS = ['팀원', '근태', '보고서'];

const SOLO_CHECKLIST_ITEMS = [
  { id: 'menu',    label: '메뉴 이미지 등록 완료',    desc: '메뉴 관리에서 대표 이미지 추가' },
  { id: 'qr',      label: 'QR 코드 테이블 부착 완료', desc: '설정에서 QR 코드 다운로드 후 출력' },
  { id: 'hours',   label: '영업시간 설정 완료',        desc: '매장 정보에서 운영 시간 입력' },
  { id: 'payment', label: '결제 방식 설정 완료',       desc: '결제 설정에서 카드·현금 옵션 확인' },
  { id: 'test',    label: '시범 주문 테스트 완료',     desc: 'QR 스캔 후 메뉴 주문까지 전체 플로우 확인' },
];

// ── 유틸 ───────────────────────────────────────────────────
const fmt = (d) => formatTime(d);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ko-KR') : '';
const fmtHours = (h) => h != null ? `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m` : '-';
const getInitials = (name = '') => name.slice(0, 2).toUpperCase();
const roleColors = ['bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500', 'bg-rose-500'];
const avatarColor = (id) => roleColors[id % roleColors.length];

const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonthStr = () => new Date().toISOString().slice(0, 7);

// ── 라이브 타이머 ─────────────────────────────────────────
const SoloLiveTimer = ({ clockIn }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(clockIn).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [clockIn]);

  return <span className="font-mono text-5xl font-black text-orange-400 tabular-nums tracking-tight">{elapsed}</span>;
};

// ── 셋업 체크리스트 ───────────────────────────────────────
const SoloChecklist = ({ storeId }) => {
  const key = `solo-check-${storeId}`;
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  });

  const toggle = (id) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem(key, JSON.stringify(next));
  };

  const done = SOLO_CHECKLIST_ITEMS.filter(i => checked[i.id]).length;
  const pct = Math.round((done / SOLO_CHECKLIST_ITEMS.length) * 100);

  return (
    <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-white font-black text-sm">1인 매장 셋업 체크리스트</h3>
          <p className="text-slate-500 text-xs mt-0.5">{done}/{SOLO_CHECKLIST_ITEMS.length} 완료</p>
        </div>
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
            <circle cx="24" cy="24" r="20" fill="none" stroke="#f97316" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 20 * pct / 100} ${2 * Math.PI * 20}`} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-orange-400 font-black text-[10px]">{pct}%</span>
        </div>
      </div>

      <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
        />
      </div>

      <div className="space-y-2">
        {SOLO_CHECKLIST_ITEMS.map((item) => (
          <button key={item.id} onClick={() => toggle(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
              checked[item.id]
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'bg-white/5 border border-transparent hover:bg-white/8'
            }`}>
            <div className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all ${
              checked[item.id] ? 'bg-emerald-500' : 'border border-white/20'
            }`}>
              {checked[item.id] && <Check size={12} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm transition-all ${checked[item.id] ? 'text-emerald-400 line-through' : 'text-white'}`}>
                {item.label}
              </p>
              <p className="text-slate-500 text-[10px] mt-0.5">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {done === SOLO_CHECKLIST_ITEMS.length && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-black">
          <Sparkles size={14} /> 모든 설정이 완료됐습니다! 이제 본격 운영 시작!
        </motion.div>
      )}
    </div>
  );
};

// ── 솔로 모드 배너 (팀원 탭) ──────────────────────────────
const SoloModeBanner = ({ myStaffId, attendance, storeId, onSelfRegister, selfRegLoading, onAddStaff, onGoAttend }) => {
  const activeRecord = myStaffId ? attendance.find(r => r.staff_id === myStaffId && !r.clock_out) : null;
  const todayDone = myStaffId ? attendance.filter(r => r.staff_id === myStaffId && r.clock_out) : [];
  const totalToday = todayDone.reduce((s, r) => s + (r.work_hours || 0), 0);
  const isWorking = !!activeRecord;

  return (
    <div className="space-y-6">
      {/* 히어로 상태 카드 */}
      <div className={`relative overflow-hidden rounded-[2rem] p-8 border transition-all ${
        isWorking
          ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/5 border-orange-500/30'
          : 'bg-gradient-to-br from-slate-800/60 to-slate-900/40 border-white/10'
      }`}>
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl opacity-10 pointer-events-none"
          style={{ background: isWorking ? '#f97316' : '#475569' }} />

        <div className="relative flex items-start justify-between flex-wrap gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2.5 h-2.5 rounded-full ${isWorking ? 'bg-orange-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className={`font-black text-[10px] tracking-widest uppercase ${isWorking ? 'text-orange-400' : 'text-slate-500'}`}>
                {isWorking ? 'OPEN · 영업 중' : 'STANDBY · 대기 중'}
              </span>
            </div>
            <h2 className="text-white font-black text-2xl mb-1">1인 매장 운영 모드</h2>
            <p className="text-slate-400 text-sm mb-4">혼자서도 완벽한 매장 관리 — 출퇴근·근태·매출 통합 추적</p>

            {isWorking ? (
              <div>
                <p className="text-slate-500 text-[10px] font-black tracking-widest uppercase mb-1">오늘 근무시간</p>
                <SoloLiveTimer clockIn={activeRecord.clock_in} />
                <p className="text-slate-500 text-xs mt-1.5">시작: {fmt(activeRecord.clock_in)}</p>
              </div>
            ) : totalToday > 0 ? (
              <div className="flex items-center gap-2 text-blue-400">
                <Clock size={14} />
                <span className="font-bold text-sm">오늘 완료: {fmtHours(totalToday)}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 shrink-0">
            {myStaffId ? (
              <button onClick={onGoAttend}
                className={`px-6 py-3 rounded-2xl font-black text-xs tracking-widest flex items-center gap-2 transition-all shadow-lg ${
                  isWorking
                    ? 'bg-orange-500 text-white shadow-orange-500/30 hover:scale-105'
                    : 'bg-emerald-500 text-white shadow-emerald-500/30 hover:scale-105'
                }`}>
                {isWorking ? <><LogOut size={14} /> 퇴근 처리하기</> : <><LogIn size={14} /> 출근 처리하기</>}
              </button>
            ) : (
              <button onClick={onSelfRegister} disabled={selfRegLoading}
                className="px-6 py-3 bg-amber-500 text-white rounded-2xl font-black text-xs tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-amber-500/30 disabled:opacity-60 disabled:scale-100">
                <Zap size={14} />
                {selfRegLoading ? '활성화 중...' : '셀프 근태 추적 시작'}
              </button>
            )}
            <button onClick={onAddStaff}
              className="px-6 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-black text-xs tracking-widest flex items-center gap-2 hover:text-white hover:bg-white/10 transition-all">
              <Plus size={14} /> 팀원 초대하기
            </button>
          </div>
        </div>
      </div>

      {/* 셀프 근태 미등록 안내 */}
      {!myStaffId && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
          <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-black text-sm">셀프 근태 추적 미활성화</p>
            <p className="text-slate-400 text-xs mt-1">
              위 버튼을 누르면 오너 본인의 출퇴근 기록이 시작됩니다.
              이후 근태 탭에서 출근/퇴근 처리 및 월별 근무 보고서를 확인할 수 있습니다.
            </p>
          </div>
        </motion.div>
      )}

      {/* 셋업 체크리스트 */}
      <SoloChecklist storeId={storeId} />

      {/* 운영 가이드 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: QrCode, label: 'QR 코드',      desc: 'QR을 출력해 각 테이블에 부착하면 고객이 직접 주문할 수 있어요.',         color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
          { icon: Timer,  label: '영업시간 설정', desc: '매장 정보에서 요일별 영업시간과 정기 휴무일을 등록하세요.',              color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
          { icon: Wifi,   label: '실시간 주문',   desc: '주문이 들어오면 즉시 알림을 수신합니다. 브라우저 알림을 허용해 주세요.', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
        ].map(({ icon: Icon, label, desc, color, bg, border }) => (
          <div key={label} className={`${bg} border ${border} rounded-2xl p-5`}>
            <Icon size={20} className={`${color} mb-3`} />
            <p className="text-white font-black text-sm mb-1">{label}</p>
            <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── 솔로 근태 패널 (근태 탭 상단) ────────────────────────
const SoloAttendancePanel = ({ myStaffId, attendance, onClockIn, onClockOut }) => {
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  if (!myStaffId) {
    return (
      <div className="mb-8 p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center gap-4">
        <AlertCircle size={24} className="text-amber-400 shrink-0" />
        <div>
          <p className="text-amber-400 font-black">셀프 근태 미활성화</p>
          <p className="text-slate-400 text-sm mt-1">팀원 탭에서 "셀프 근태 추적 시작"을 먼저 눌러주세요.</p>
        </div>
      </div>
    );
  }

  const todayRecords = attendance.filter(r => r.staff_id === myStaffId);
  const activeRecord = todayRecords.find(r => !r.clock_out);
  const isWorking = !!activeRecord;
  const totalToday = todayRecords.reduce((s, r) => s + (r.work_hours || 0), 0);

  return (
    <div className="mb-8">
      <div className={`rounded-[2rem] p-8 border transition-all ${
        isWorking
          ? 'bg-gradient-to-br from-orange-500/15 to-amber-500/5 border-orange-500/30'
          : 'bg-white/5 border-white/10'
      }`}>
        <div className="flex items-start justify-between flex-wrap gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-2.5 h-2.5 rounded-full ${isWorking ? 'bg-orange-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className={`font-black text-[10px] tracking-widest uppercase ${isWorking ? 'text-orange-400' : 'text-slate-500'}`}>
                내 근무 현황
              </span>
            </div>

            {isWorking ? (
              <>
                <p className="text-slate-400 text-sm mb-2">시작: {fmt(activeRecord.clock_in)}</p>
                <SoloLiveTimer clockIn={activeRecord.clock_in} />
                {totalToday > 0 && (
                  <p className="text-slate-500 text-xs mt-2">오늘 누적: {fmtHours(totalToday)}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-3xl font-black text-white">오늘 미출근</p>
                {totalToday > 0 && (
                  <p className="text-blue-400 font-bold text-sm mt-1">완료 근무: {fmtHours(totalToday)}</p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 shrink-0">
            {!isWorking ? (
              showNote ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={note} onChange={e => setNote(e.target.value)}
                    placeholder="오늘의 메모 (선택)"
                    className="px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-orange-500/30 w-44"
                  />
                  <button onClick={() => { onClockIn(note); setNote(''); setShowNote(false); }}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs hover:scale-105 transition-all">
                    출근
                  </button>
                  <button onClick={() => setShowNote(false)}
                    className="w-8 h-8 bg-white/5 text-slate-400 rounded-xl flex items-center justify-center">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowNote(true)}
                  className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-emerald-500/30">
                  <LogIn size={16} /> 출근 처리
                </button>
              )
            ) : (
              <button onClick={onClockOut}
                className="px-8 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-orange-500/30">
                <LogOut size={16} /> 퇴근 처리
              </button>
            )}
          </div>
        </div>

        {todayRecords.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-slate-500 font-black text-[9px] tracking-widest uppercase mb-3">오늘 근무 기록</p>
            <div className="space-y-2">
              {todayRecords.map((r, i) => (
                <div key={r.id ?? i} className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <LogIn size={11} /> {fmt(r.clock_in)}
                  </span>
                  {r.clock_out && (
                    <>
                      <span className="text-slate-600">→</span>
                      <span className="text-blue-400 font-bold flex items-center gap-1">
                        <LogOut size={11} /> {fmt(r.clock_out)}
                      </span>
                      <span className="text-orange-400 font-black">{fmtHours(r.work_hours)}</span>
                    </>
                  )}
                  {r.note && <span className="text-slate-500 text-xs">· {r.note}</span>}
                  {!r.clock_out && (
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-[9px] font-black">근무 중</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── 메인 컴포넌트 ─────────────────────────────────────────
const StaffManager = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [store, setStore] = useState(null);
  const [staff, setStaff] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [myStaffId, setMyStaffId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selfRegLoading, setSelfRegLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [attendDate, setAttendDate] = useState(todayStr());
  const [attendance, setAttendance] = useState([]);
  const [attendLoading, setAttendLoading] = useState(false);

  const [reportMonth, setReportMonth] = useState(thisMonthStr());
  const [report, setReport] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const [storeRes, staffRes, roleRes] = await Promise.all([
        storesAPI.getById(storeId),
        staffAPI.getByStore(storeId),
        staffAPI.getMyRole(storeId),
      ]);
      setStore(storeRes.data);
      setStaff(staffRes.data);
      setMyRole(roleRes.data.role);
      setMyStaffId(roleRes.data.staff_id ?? null);
    } catch (err) {
      if (err.response?.status === 403) navigate('/admin');
    } finally {
      setLoading(false);
    }
  }, [storeId, navigate]);

  const fetchAttendance = useCallback(async (date = attendDate) => {
    setAttendLoading(true);
    try {
      const res = await staffAPI.getAttendance(storeId, { date });
      setAttendance(res.data || []);
    } catch { /* 조용히 실패 */ }
    finally { setAttendLoading(false); }
  }, [storeId, attendDate]);

  const fetchReport = useCallback(async (month = reportMonth) => {
    setReportLoading(true);
    try {
      const res = await staffAPI.getAttendance(storeId, { month });
      const records = res.data || [];
      const map = {};
      for (const r of records) {
        const key = r.staff_id;
        if (!map[key]) {
          map[key] = {
            staff_id: r.staff_id,
            name: r.staff?.users?.name || '(알 수 없음)',
            role: r.staff?.role,
            days: new Set(),
            totalHours: 0,
            count: 0,
          };
        }
        if (r.clock_in) map[key].days.add(r.clock_in.slice(0, 10));
        map[key].totalHours += r.work_hours || 0;
        map[key].count += 1;
      }
      setReport(Object.values(map).map(m => ({
        ...m,
        days: m.days.size,
        avgHours: m.count > 0 ? m.totalHours / m.count : 0,
      })).sort((a, b) => b.totalHours - a.totalHours));
    } catch { /* 조용히 실패 */ }
    finally { setReportLoading(false); }
  }, [storeId, reportMonth]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => { if (tab === 1) fetchAttendance(attendDate); }, [tab, attendDate]); // eslint-disable-line
  useEffect(() => { if (tab === 2) fetchReport(reportMonth); }, [tab, reportMonth]); // eslint-disable-line
  // 솔로 모드: 팀원 탭에서도 오늘 근태 상태 표시
  useEffect(() => { if (myStaffId && tab === 0) fetchAttendance(todayStr()); }, [myStaffId]); // eslint-disable-line

  const handleRoleChange = async (id, role) => {
    try { await staffAPI.updateRole(id, role); fetchStaff(); } catch (e) { handleApiError(e, '역할 변경 실패'); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`${name} 직원을 삭제하시겠습니까?`)) return;
    try { await staffAPI.delete(id); fetchStaff(); } catch (e) { handleApiError(e, '직원 삭제 실패'); }
  };

  const handleClockIn = async (staffId) => {
    try { await staffAPI.clockIn(staffId); fetchAttendance(); } catch (e) { handleApiError(e, '출근 처리 실패'); }
  };

  const handleClockOut = async (staffId) => {
    try { await staffAPI.clockOut(staffId); fetchAttendance(); } catch (e) { handleApiError(e, '퇴근 처리 실패'); }
  };

  const handleSoloClockIn = async (note = '') => {
    if (!myStaffId) return;
    try { await staffAPI.clockIn(myStaffId, note); fetchAttendance(); } catch (e) { handleApiError(e, '출근 처리 실패'); }
  };

  const handleSoloClockOut = async () => {
    if (!myStaffId) return;
    try { await staffAPI.clockOut(myStaffId); fetchAttendance(); } catch (e) { handleApiError(e, '퇴근 처리 실패'); }
  };

  const handleSelfRegister = async () => {
    setSelfRegLoading(true);
    try {
      const res = await staffAPI.selfRegister(parseInt(storeId));
      setMyStaffId(res.data.id);
      await fetchStaff();
      await fetchAttendance(todayStr());
    } catch (e) {
      handleApiError(e, '셀프 등록에 실패했습니다');
    } finally {
      setSelfRegLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full mb-4" />
      <p className="text-slate-500 font-black text-xs tracking-widest uppercase">Loading Staff...</p>
    </div>
  );

  const canManage = myRole === 'owner' || myRole === 'manager';
  const isSoloStore = staff.filter(s => s.role !== 'owner').length === 0;

  return (
    <div className="max-w-6xl mx-auto pb-20 px-4">
      {/* 헤더 */}
      <div className="flex items-center gap-6 mb-10">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/admin')}
          className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <ArrowLeft size={22} />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            HUMAN RESOURCES <Users size={24} className="text-orange-500" />
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">
            {store?.name} — {isSoloStore ? '1인 매장 운영 모드' : '직원 권한 및 근태 관리'}
          </p>
        </div>
        {isSoloStore ? (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <div className="w-2 h-2 bg-amber-400 rounded-full" />
            <span className="text-amber-400 font-black text-[10px] tracking-widest uppercase">SOLO MODE</span>
          </div>
        ) : (
          canManage && tab === 0 && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddModal(true)}
              className="h-14 px-8 bg-orange-500 text-white rounded-2xl flex items-center gap-3 font-black text-[10px] tracking-widest shadow-2xl shadow-orange-500/30">
              <Plus size={18} /> ADD STAFF
            </motion.button>
          )
        )}
      </div>

      {/* 탭 */}
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 mb-8 w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-8 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all flex items-center gap-2 ${
              tab === i ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {i === 0 && <Users size={13} />}
            {i === 1 && <Clock size={13} />}
            {i === 2 && <BarChart2 size={13} />}
            {t}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 0 && (
          <TeamTab key="team" staff={staff} myRole={myRole} canManage={canManage}
            onRoleChange={handleRoleChange} onDelete={handleDelete}
            isSoloStore={isSoloStore} myStaffId={myStaffId} attendance={attendance}
            onSelfRegister={handleSelfRegister} selfRegLoading={selfRegLoading}
            onAddStaff={() => setShowAddModal(true)} onGoAttend={() => setTab(1)}
            storeId={storeId}
          />
        )}
        {tab === 1 && (
          <AttendTab key="attend" staff={staff} attendance={attendance} loading={attendLoading}
            date={attendDate} onDateChange={setAttendDate}
            onClockIn={handleClockIn} onClockOut={handleClockOut}
            onRefresh={() => fetchAttendance(attendDate)} canManage={canManage}
            isSoloStore={isSoloStore} myStaffId={myStaffId}
            onSoloClockIn={handleSoloClockIn} onSoloClockOut={handleSoloClockOut}
          />
        )}
        {tab === 2 && (
          <ReportTab key="report" report={report} loading={reportLoading}
            month={reportMonth} onMonthChange={setReportMonth}
            isSoloStore={isSoloStore} myStaffId={myStaffId}
          />
        )}
      </AnimatePresence>

      {showAddModal && (
        <AddStaffModal storeId={storeId} myRole={myRole}
          onClose={() => setShowAddModal(false)}
          onSave={() => { setShowAddModal(false); fetchStaff(); }}
        />
      )}
    </div>
  );
};

// ── 팀원 탭 ──────────────────────────────────────────────
const TeamTab = ({ staff, myRole, canManage, onRoleChange, onDelete, isSoloStore, myStaffId, attendance, onSelfRegister, selfRegLoading, onAddStaff, onGoAttend, storeId }) => {
  const [editingId, setEditingId] = useState(null);
  const [pendingRole, setPendingRole] = useState('');

  if (isSoloStore) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
        <SoloModeBanner
          myStaffId={myStaffId}
          attendance={attendance}
          storeId={storeId}
          onSelfRegister={onSelfRegister}
          selfRegLoading={selfRegLoading}
          onAddStaff={onAddStaff}
          onGoAttend={onGoAttend}
        />
      </motion.div>
    );
  }

  const counts = Object.fromEntries(Object.keys(ROLES).map(r => [r, staff.filter(s => s.role === r).length]));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(ROLES).map(([code, r]) => {
          const Icon = r.icon;
          return (
            <div key={code} className={`bg-white/5 border ${r.border} rounded-[1.5rem] p-5`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 ${r.color} rounded-xl flex items-center justify-center`}>
                  <Icon size={14} className="text-white" />
                </div>
                <span className={`font-black text-xs tracking-widest uppercase ${r.text}`}>{r.label}</span>
              </div>
              <p className="text-3xl font-black text-white">{counts[code] || 0}<span className="text-sm text-slate-500 ml-1">명</span></p>
              <div className="flex flex-wrap gap-1 mt-3">
                {r.perms.map(p => (
                  <span key={p} className="px-2 py-0.5 bg-white/5 text-slate-400 rounded-full text-[9px] font-bold tracking-wide">{p}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {staff.map(member => {
          const role = ROLES[member.role] || ROLES.staff;
          const Icon = role.icon;
          const canEdit = canManage && (myRole === 'owner' || member.role !== 'manager');
          const isEditing = editingId === member.id;

          return (
            <motion.div key={member.id} layout className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-[2rem] p-6 hover:bg-white/8 transition-all group">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 ${avatarColor(member.id)} rounded-2xl flex items-center justify-center`}>
                    <span className="text-white font-black text-lg">{getInitials(member.name)}</span>
                  </div>
                  <div>
                    <p className="text-white font-black text-lg leading-tight">{member.name}</p>
                    <p className="text-slate-500 text-xs font-bold mt-0.5">{member.email}</p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => { setEditingId(member.id); setPendingRole(member.role); }}
                      className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => onDelete(member.id, member.name)}
                      className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-rose-400 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2 mt-2">
                  <select value={pendingRole} onChange={e => setPendingRole(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-white/10 rounded-xl text-white text-xs font-bold">
                    {Object.entries(ROLES).filter(([c]) => c !== 'owner').map(([code, r]) => (
                      <option key={code} value={code}>{r.label}</option>
                    ))}
                  </select>
                  <button onClick={() => { onRoleChange(member.id, pendingRole); setEditingId(null); }}
                    className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-400">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${role.border} bg-white/5`}>
                    <Icon size={12} className={role.text} />
                    <span className={`font-black text-[10px] tracking-widest uppercase ${role.text}`}>{role.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {role.perms.slice(0, 2).map(p => (
                      <span key={p} className="px-2 py-0.5 bg-white/5 text-slate-500 rounded-full text-[9px] font-bold">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-slate-600 text-[10px] font-bold tracking-widest uppercase mt-4">
                입사 {fmtDate(member.created_at)}
              </p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ── 근태 탭 ──────────────────────────────────────────────
const AttendTab = ({ staff, attendance, loading, date, onDateChange, onClockIn, onClockOut, onRefresh, canManage, isSoloStore, myStaffId, onSoloClockIn, onSoloClockOut }) => {
  const activeMap = {};
  for (const r of attendance) {
    if (!activeMap[r.staff_id] || new Date(r.clock_in) > new Date(activeMap[r.staff_id].clock_in)) {
      activeMap[r.staff_id] = r;
    }
  }

  const visibleStaff = isSoloStore ? staff.filter(s => s.role !== 'owner') : staff;
  const working = visibleStaff.filter(s => activeMap[s.id] && !activeMap[s.id].clock_out);
  const done    = visibleStaff.filter(s => activeMap[s.id] && activeMap[s.id].clock_out);
  const absent  = visibleStaff.filter(s => !activeMap[s.id]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      {isSoloStore && (
        <SoloAttendancePanel
          myStaffId={myStaffId}
          attendance={attendance}
          onClockIn={onSoloClockIn}
          onClockOut={onSoloClockOut}
        />
      )}

      <div className="flex items-center gap-4 mb-8">
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
          <Calendar size={16} className="text-slate-400" />
          <input type="date" aria-label="날짜 선택" value={date} onChange={e => onDateChange(e.target.value)}
            className="bg-transparent text-white font-bold text-sm outline-none" />
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onRefresh}
          className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </motion.button>
        {!isSoloStore && (
          <div className="flex gap-3 ml-auto">
            <Stat label="근무 중" value={working.length} color="text-emerald-400" />
            <Stat label="퇴근 완료" value={done.length} color="text-blue-400" />
            <Stat label="미출근" value={absent.length} color="text-slate-500" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} dark className="h-20 rounded-[2rem]" />)}</div>
      ) : (
        <div className="space-y-3">
          {visibleStaff.length === 0 && (
            <EmptyState
              tone="dark"
              icon="🧑‍🍳"
              title={isSoloStore ? '1인 운영 중' : '등록된 직원이 없습니다'}
              description={isSoloStore ? '팀원을 추가하면 근태를 관리할 수 있어요.' : '직원을 초대해 함께 운영해 보세요.'}
            />
          )}
          {working.length > 0 && <SectionLabel label="근무 중" color="text-emerald-400" dot="bg-emerald-400" />}
          {working.map(s => <AttendCard key={s.id} member={s} record={activeMap[s.id]} status="working" canManage={canManage} onClockOut={() => onClockOut(s.id)} />)}
          {done.length > 0 && <SectionLabel label="퇴근 완료" color="text-blue-400" dot="bg-blue-400" />}
          {done.map(s => <AttendCard key={s.id} member={s} record={activeMap[s.id]} status="done" canManage={canManage} />)}
          {absent.length > 0 && <SectionLabel label="미출근" color="text-slate-500" dot="bg-slate-600" />}
          {absent.map(s => <AttendCard key={s.id} member={s} record={null} status="absent" canManage={canManage} onClockIn={() => onClockIn(s.id)} />)}
        </div>
      )}
    </motion.div>
  );
};

const SectionLabel = ({ label, color, dot }) => (
  <div className={`flex items-center gap-2 py-2 ${color} font-black text-[10px] tracking-widest uppercase`}>
    <div className={`w-2 h-2 rounded-full ${dot} animate-pulse`} /> {label}
  </div>
);

const Stat = ({ label, value, color }) => (
  <div className="bg-white/5 border border-white/5 rounded-2xl px-5 py-3 text-center">
    <p className={`text-2xl font-black ${color}`}>{value}</p>
    <p className="text-slate-600 font-bold text-[9px] tracking-widest uppercase mt-0.5">{label}</p>
  </div>
);

const AttendCard = ({ member, record, status, canManage, onClockIn, onClockOut }) => {
  const role = ROLES[member.role] || ROLES.staff;
  const Icon = role.icon;
  return (
    <motion.div layout className="bg-white/5 border border-white/5 rounded-[1.5rem] p-5 flex items-center gap-5">
      <div className={`w-12 h-12 ${avatarColor(member.id)} rounded-xl flex items-center justify-center shrink-0`}>
        <span className="text-white font-black">{getInitials(member.name)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white font-black">{member.name}</span>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border ${role.border}`}>
            <Icon size={10} className={role.text} />
            <span className={`font-black text-[9px] tracking-widest uppercase ${role.text}`}>{role.label}</span>
          </div>
        </div>
        {record ? (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400 font-bold flex items-center gap-1">
              <LogIn size={11} className="text-emerald-400" /> {fmt(record.clock_in)}
            </span>
            {record.clock_out && (
              <>
                <span className="text-slate-400 font-bold flex items-center gap-1">
                  <LogOut size={11} className="text-blue-400" /> {fmt(record.clock_out)}
                </span>
                <span className="text-orange-400 font-black">{fmtHours(record.work_hours)}</span>
              </>
            )}
          </div>
        ) : (
          <span className="text-slate-600 font-bold text-xs">근태 기록 없음</span>
        )}
      </div>
      {canManage && (
        <div className="shrink-0">
          {status === 'absent' && (
            <button onClick={onClockIn}
              className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-black text-[10px] tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-2">
              <LogIn size={12} /> 출근
            </button>
          )}
          {status === 'working' && (
            <button onClick={onClockOut}
              className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl font-black text-[10px] tracking-widest hover:bg-blue-500/20 transition-all flex items-center gap-2">
              <LogOut size={12} /> 퇴근
            </button>
          )}
          {status === 'done' && (
            <span className="px-4 py-2 bg-white/5 text-slate-500 rounded-xl font-black text-[10px] tracking-widest">완료</span>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ── 보고서 탭 ──────────────────────────────────────────────
const ReportTab = ({ report, loading, month, onMonthChange, isSoloStore, myStaffId }) => {
  const totalHours = report.reduce((s, r) => s + r.totalHours, 0);
  const totalDays  = report.reduce((s, r) => s + r.days, 0);
  const maxHours   = Math.max(...report.map(r => r.totalHours), 1);
  const myRecord   = isSoloStore && myStaffId ? report.find(r => r.staff_id === myStaffId) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="flex items-center gap-4 mb-8">
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
          <Calendar size={16} className="text-slate-400" />
          <input type="month" aria-label="월 선택" value={month} onChange={e => onMonthChange(e.target.value)}
            className="bg-transparent text-white font-bold text-sm outline-none" />
        </div>
        <div className="flex gap-3 ml-auto">
          <Stat label="총 근무일" value={totalDays} color="text-orange-400" />
          <Stat label="총 근무시간" value={`${Math.round(totalHours)}h`} color="text-blue-400" />
          <Stat label={isSoloStore ? '기록 여부' : '직원 수'} value={isSoloStore ? (myRecord ? '있음' : '없음') : report.length} color="text-emerald-400" />
        </div>
      </div>

      {/* 솔로 모드: 내 이달 요약 카드 */}
      {isSoloStore && myRecord && (
        <div className="mb-6 bg-gradient-to-br from-orange-500/15 to-amber-500/5 border border-orange-500/30 rounded-[2rem] p-6">
          <p className="text-orange-400 font-black text-[10px] tracking-widest uppercase mb-4">이달의 내 근무 요약</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '근무일',  value: `${myRecord.days}일`,          color: 'text-white' },
              { label: '총 시간', value: fmtHours(myRecord.totalHours), color: 'text-orange-400' },
              { label: '일 평균', value: fmtHours(myRecord.avgHours),   color: 'text-blue-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 rounded-2xl p-4 text-center">
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-slate-500 text-[9px] font-black tracking-widest uppercase mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : report.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
          <AlertCircle size={40} className="text-slate-700 mb-4" />
          <p className="text-slate-500 font-black text-xs tracking-widest uppercase">해당 월의 근태 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/5 rounded-[2rem] overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 text-[9px] font-black text-slate-500 tracking-widest uppercase">
            <div className="col-span-3">직원</div>
            <div className="col-span-2 text-center">역할</div>
            <div className="col-span-2 text-center">근무일</div>
            <div className="col-span-2 text-center">총 시간</div>
            <div className="col-span-2 text-center">일 평균</div>
            <div className="col-span-1"></div>
          </div>
          {report.map((r, i) => {
            const role = ROLES[r.role] || ROLES.staff;
            const barPct = maxHours > 0 ? (r.totalHours / maxHours) * 100 : 0;
            const isMe = isSoloStore && r.staff_id === myStaffId;
            return (
              <div key={r.staff_id}
                className={`grid grid-cols-12 gap-4 px-6 py-5 items-center transition-all ${
                  isMe ? 'bg-orange-500/5 border-l-2 border-orange-500' : i % 2 === 0 ? '' : 'bg-white/[0.02]'
                } hover:bg-white/[0.04]`}>
                <div className="col-span-3 flex items-center gap-3">
                  <div className={`w-9 h-9 ${avatarColor(r.staff_id)} rounded-xl flex items-center justify-center`}>
                    <span className="text-white font-black text-xs">{getInitials(r.name)}</span>
                  </div>
                  <div>
                    <span className="text-white font-black text-sm">{r.name}</span>
                    {isMe && <span className="ml-2 text-orange-400 text-[9px] font-black">나</span>}
                  </div>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`px-2 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${role.text} border ${role.border} bg-white/5`}>{role.label}</span>
                </div>
                <div className="col-span-2 text-center text-white font-black">{r.days}<span className="text-slate-500 text-xs ml-1">일</span></div>
                <div className="col-span-2 text-center text-orange-400 font-black">{fmtHours(r.totalHours)}</div>
                <div className="col-span-2 text-center text-blue-400 font-black">{fmtHours(r.avgHours)}</div>
                <div className="col-span-1">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${barPct}%` }} transition={{ duration: 0.8, delay: i * 0.05 }}
                      className={`h-full rounded-full ${isMe ? 'bg-orange-400' : 'bg-orange-500'}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

// ── 직원 추가 모달 ─────────────────────────────────────────
const AddStaffModal = ({ storeId, myRole, onClose, onSave }) => {
  // ① 휴대폰 조회 상태
  const [phone, setPhone] = useState('');
  const [lookupState, setLookupState] = useState('idle'); // idle|loading|found|notFound|alreadyStaff
  const [foundUser, setFoundUser] = useState(null);
  const [lookupRole, setLookupRole] = useState('staff');

  // ② 신규 계정 생성 폼
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleOptions = Object.entries(ROLES).filter(([c]) =>
    c !== 'owner' && (c !== 'manager' || myRole === 'owner')
  );

  const formatPhone = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
    return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  };

  const handlePhoneChange = (e) => {
    setPhone(formatPhone(e.target.value));
    if (lookupState !== 'idle') { setLookupState('idle'); setFoundUser(null); }
  };

  const handleLookup = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setError('유효한 휴대폰 번호를 입력해주세요.'); return; }
    setError('');
    setLookupState('loading');
    try {
      const res = await staffAPI.lookupByPhone(digits, storeId);
      const d = res.data?.data ?? res.data;
      if (!d.found) { setLookupState('notFound'); setShowNewForm(true); }
      else if (d.alreadyStaff) { setLookupState('alreadyStaff'); }
      else { setFoundUser(d.user); setLookupState('found'); }
    } catch (e) {
      setError(e.response?.data?.error || '조회 중 오류가 발생했습니다.');
      setLookupState('idle');
    }
  };

  const handleAddExisting = async () => {
    setLoading(true); setError('');
    try {
      await staffAPI.addExisting({ storeId: parseInt(storeId), userId: foundUser.id, role: lookupRole });
      onSave();
    } catch (e) {
      setError(e.response?.data?.error || '팀원 추가에 실패했습니다.');
    } finally { setLoading(false); }
  };

  const handleCreateNew = async (e) => {
    e.preventDefault(); setError('');
    if (!form.name || !form.email || !form.password) { setError('모든 필드를 입력해주세요.'); return; }
    if (form.password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    setLoading(true);
    try {
      await staffAPI.create({ ...form, storeId: parseInt(storeId) });
      onSave();
    } catch (e) {
      setError(e.response?.data?.error || '직원 등록에 실패했습니다.');
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-7">
          <div>
            <h3 className="text-3xl font-black text-white tracking-tight">ADD STAFF</h3>
            <p className="text-xs text-slate-500 font-bold mt-1">팀원 초대 · 권한 부여</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm font-bold">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* ── SECTION 1: 휴대폰 조회 (MAIN) ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-black">1</span>
            </div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">휴대폰 번호로 초대</span>
            <span className="ml-auto text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-black shrink-0">추천</span>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="010-0000-0000"
                className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none focus:border-orange-500/50 transition-all text-sm tracking-wider"
              />
            </div>
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookupState === 'loading' || phone.replace(/\D/g,'').length < 10}
              className="px-5 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs tracking-widest shadow-lg shadow-orange-500/20 hover:scale-105 transition-all disabled:opacity-40 disabled:scale-100 flex items-center gap-2 shrink-0">
              {lookupState === 'loading'
                ? <Loader2 size={15} className="animate-spin" />
                : <Search size={15} />}
              조회
            </button>
          </div>

          {/* 결과: 사용자 발견 */}
          {lookupState === 'found' && foundUser && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-black truncate">{foundUser.name}</p>
                  <p className="text-emerald-400 text-xs font-bold">{foundUser.phone}</p>
                </div>
                <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black shrink-0">계정 확인됨</span>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">역할 지정</label>
                <select value={lookupRole} onChange={e => setLookupRole(e.target.value)}
                  className="w-full px-5 py-3 bg-white/5 border border-white/5 rounded-xl text-white font-bold outline-none focus:border-orange-500/30 transition-all text-sm">
                  {roleOptions.map(([code, r]) => (
                    <option key={code} value={code} className="bg-slate-900">{r.label} — {r.perms.join(', ')}</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={handleAddExisting} disabled={loading}
                className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                팀원으로 등록
              </button>
            </motion.div>
          )}

          {/* 결과: 이미 팀원 */}
          {lookupState === 'alreadyStaff' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
              <p className="text-amber-400 text-sm font-bold">이미 이 매장의 팀원입니다.</p>
            </motion.div>
          )}

          {/* 결과: 계정 없음 */}
          {lookupState === 'notFound' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-slate-800/60 border border-white/5 rounded-2xl flex items-center gap-3">
              <XCircle size={16} className="text-slate-500 shrink-0" />
              <div>
                <p className="text-slate-300 text-sm font-bold">등록된 계정이 없습니다.</p>
                <p className="text-slate-500 text-xs mt-0.5">아래에서 신규 계정을 생성해 주세요.</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">또는</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {/* ── SECTION 2: 신규 계정 생성 (SECONDARY) ── */}
        <div>
          <button type="button" onClick={() => setShowNewForm(!showNewForm)}
            className="w-full flex items-center justify-between px-5 py-4 bg-white/5 hover:bg-white/[0.08] rounded-2xl transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-black">2</span>
              </div>
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-300 transition-all">신규 계정 직접 생성</span>
            </div>
            {showNewForm ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </button>

          {showNewForm && (
            <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onSubmit={handleCreateNew} className="mt-4 space-y-4">
              {[
                { label: '이름',     field: 'name',     type: 'text',     placeholder: '홍길동' },
                { label: '이메일',   field: 'email',    type: 'email',    placeholder: 'staff@example.com' },
                { label: '비밀번호', field: 'password', type: 'password', placeholder: '6자 이상' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field} className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
                  <input type={type} aria-label={label} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none focus:border-orange-500/30 transition-all text-sm" />
                </div>
              ))}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">역할</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full px-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none focus:border-orange-500/30 transition-all text-sm">
                  {roleOptions.map(([code, r]) => (
                    <option key={code} value={code} className="bg-slate-900">{r.label} — {r.perms.join(', ')}</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                직원 계정 생성 후 등록
              </button>
            </motion.form>
          )}
        </div>

        {/* Cancel */}
        <button type="button" onClick={onClose}
          className="mt-5 w-full py-3 bg-white/5 text-slate-400 rounded-2xl font-black text-xs tracking-widest hover:text-white transition-all">
          취소
        </button>
      </motion.div>
    </motion.div>
  );
};

export default StaffManager;
