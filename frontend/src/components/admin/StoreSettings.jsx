import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { storesAPI, tierSettingsAPI } from '../../api';
import { Clock, Palette, Save, CheckCircle2, ChevronDown, ChevronUp, Sun, Moon, Store, Type, Layout, Brush, ToggleLeft, ToggleRight, CopyCheck, Award, Plus, Trash2, Edit3 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useSEO } from '../../lib/useSEO';
import Icon from '../ui/Icon';

// ── 상수 ─────────────────────────────────────────────────────────────────────
const DAYS = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
];

const PRESET_THEMES = [
  { name: '오렌지', primary: '#f97316', secondary: '#1e3a5f', accent: '#10b981', bg: '#f8fafc' },
  { name: '오션',   primary: '#3b82f6', secondary: '#1e293b', accent: '#f59e0b', bg: '#f0f9ff' },
  { name: '에메랄드', primary: '#10b981', secondary: '#064e3b', accent: '#f97316', bg: '#f0fdf4' },
  { name: '미드나잇', primary: '#8b5cf6', secondary: '#1e1b4b', accent: '#ec4899', bg: '#faf5ff' },
  { name: '크림슨', primary: '#ef4444', secondary: '#1f2937', accent: '#fbbf24', bg: '#fff1f2' },
  { name: '사이버펑크', primary: '#ec4899', secondary: '#4a044e', accent: '#06b6d4', bg: '#fdf4ff' },
];

const FONTS = [
  { value: 'Pretendard',       label: 'Pretendard (기본)' },
  { value: 'Noto Sans KR',     label: 'Noto Sans KR' },
  { value: 'Nanum Gothic',     label: '나눔고딕' },
  { value: 'Spoqa Han Sans Neo', label: 'Spoqa Han Sans' },
];

const LAYOUTS = [
  { value: 'grid',     label: '그리드',   desc: '2열 카드 배열' },
  { value: 'list',     label: '리스트',   desc: '세로 목록형' },
  { value: 'magazine', label: '매거진',   desc: '이미지 중심' },
];

const DEFAULT_THEME = {
  primaryColor: '#f97316',
  secondaryColor: '#1e3a5f',
  accentColor: '#10b981',
  backgroundColor: '#f8fafc',
  fontFamily: 'Pretendard',
  layoutMode: 'grid',
  cardRadius: 'lg',
};

const DEFAULT_HOURS = { open: '09:00', close: '22:00', closed: false };

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
const initDayHours = (stored) => {
  const base = DAYS.reduce((acc, d) => ({ ...acc, [d.key]: { ...DEFAULT_HOURS } }), {});
  if (!stored) return base;
  try {
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return DAYS.reduce((acc, d) => ({
      ...acc,
      [d.key]: { ...DEFAULT_HOURS, ...(parsed[d.key] || {}) },
    }), {});
  } catch { return base; }
};

// ── 섹션 래퍼 ─────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, color = 'text-blue-500', children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center ${color}`}>
            <Icon size={16} />
          </div>
          <span className="font-bold text-gray-900">{title}</span>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6 pt-2 border-t border-gray-50">{children}</div>}
    </div>
  );
}

// ── 컬러 입력 ─────────────────────────────────────────────────────────────────
function ColorField({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-white"
      />
      <div className="flex-1">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-sm font-mono w-28 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function StoreSettings() {
    useSEO({ title: '매장 설정 | 위마켓', description: '매장 정보, 테마, 결제 설정을 관리합니다.' });
    const { storeId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 영업시간
  const [globalOpen, setGlobalOpen]   = useState('09:00');
  const [globalClose, setGlobalClose] = useState('22:00');
  const [dayHours, setDayHours]       = useState(() => initDayHours(null));
  const [usePerDay, setUsePerDay]     = useState(false); // 요일별 개별 설정 여부

  // 테마
  const [theme, setTheme] = useState(DEFAULT_THEME);

  // 등급 설정
  const [tiers, setTiers] = useState([]);
  const [showTierForm, setShowTierForm] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [tierForm, setTierForm] = useState({ tier_name: 'GOLD', min_spent: 100000, earn_rate: 5.0 });
  const [tierSaving, setTierSaving] = useState(false);

  // ── 데이터 로드 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return;
    storesAPI.getById(storeId)
      .then(res => {
        const s = res.data;

        // 등급 로드
        tierSettingsAPI.getTiers(storeId)
          .then(tRes => setTiers(tRes.data || []))
          .catch(() => {});
        setGlobalOpen(s.open_time  || '09:00');
        setGlobalClose(s.close_time || '22:00');

        if (s.business_hours) {
          setDayHours(initDayHours(s.business_hours));
          setUsePerDay(true);
        }

        if (s.theme) {
          try {
            const t = typeof s.theme === 'string' ? JSON.parse(s.theme) : s.theme;
            setTheme({ ...DEFAULT_THEME, ...t });
          } catch { /* skip */ }
        }
      })
      .catch(() => toast.error('매장 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [storeId]);

  // ── 등급 CRUD ──────────────────────────────────────────────────────────────
  const fetchTiers = async () => {
    try {
      const res = await tierSettingsAPI.getTiers(storeId);
      setTiers(res.data || []);
    } catch { toast.error('등급 설정을 불러오지 못했습니다.'); }
  };

  const handleTierSubmit = async () => {
    if (!tierForm.tier_name || tierForm.min_spent === undefined || tierForm.earn_rate === undefined) {
      toast.warning('모든 항목을 입력해주세요.');
      return;
    }
    setTierSaving(true);
    try {
      await tierSettingsAPI.upsertTier(storeId, tierForm);
      toast.success('등급이 저장되었습니다.');
      fetchTiers();
      setShowTierForm(false);
      setEditingTier(null);
      setTierForm({ tier_name: 'GOLD', min_spent: 100000, earn_rate: 5.0 });
    } catch (err) {
      toast.error(err?.response?.data?.error || '저장에 실패했습니다.');
    } finally {
      setTierSaving(false);
    }
  };

  const handleEditTier = (tier) => {
    setEditingTier(tier);
    setTierForm({
      tier_name: tier.tier_name,
      min_spent: tier.min_spent,
      earn_rate: tier.earn_rate,
    });
    setShowTierForm(true);
  };

  const handleDeleteTier = async (tierName) => {
    if (!window.confirm(`'${tierName}' 등급을 삭제하시겠습니까?`)) return;
    try {
      await tierSettingsAPI.deleteTier(storeId, tierName);
      toast.success('등급이 삭제되었습니다.');
      fetchTiers();
    } catch (err) {
      toast.error(err?.response?.data?.error || '삭제에 실패했습니다.');
    }
  };

  // ── 저장 ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        open_time:  globalOpen,
        close_time: globalClose,
        business_hours: usePerDay ? JSON.stringify(dayHours) : null,
        theme: JSON.stringify(theme),
      };
      await storesAPI.update(storeId, payload);
      toast.success('설정이 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  // ── 요일별 시간 변경 ──────────────────────────────────────────────────────
  const setDay = (key, field, value) =>
    setDayHours(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  // ── 프리셋 적용 ───────────────────────────────────────────────────────────
  const applyPreset = (p) =>
    setTheme(prev => ({ ...prev, primaryColor: p.primary, secondaryColor: p.secondary, accentColor: p.accent, backgroundColor: p.bg }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mr-3" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">매장 설정</h1>
          <p className="text-sm text-slate-400 mt-0.5">영업시간, 메뉴판 테마를 관리합니다</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-400 transition-colors disabled:opacity-50 shadow-lg shadow-orange-500/25"
        >
          {saving
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Save size={16} />
          }
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* ── 영업시간 ─────────────────────────────────────────────────────── */}
      <Section title="영업시간" icon={Clock} color="text-orange-500">
        {/* 기본 시간 */}
        <div className="mb-5">
          <p className="text-sm font-bold text-gray-600 mb-3">기본 영업시간</p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">영업 시작</label>
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                <Sun size={16} className="text-orange-400" />
                <input
                  type="time"
                  value={globalOpen}
                  onChange={e => setGlobalOpen(e.target.value)}
                  className="flex-1 bg-transparent text-sm font-bold text-gray-800 focus:outline-none"
                />
              </div>
            </div>
            <span className="text-gray-300 font-bold pt-5">~</span>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">영업 종료</label>
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                <Moon size={16} className="text-indigo-400" />
                <input
                  type="time"
                  value={globalClose}
                  onChange={e => setGlobalClose(e.target.value)}
                  className="flex-1 bg-transparent text-sm font-bold text-gray-800 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 요일별 설정 토글 */}
        <button
          onClick={() => setUsePerDay(v => !v)}
          className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-4 hover:text-blue-600 transition-colors"
        >
          {usePerDay
            ? <ToggleRight size={22} className="text-blue-500" />
            : <ToggleLeft size={22} className="text-gray-300" />
          }
          요일별 개별 설정
        </button>

        {usePerDay && (
          <div className="space-y-2">
            {/* 일괄 적용 버튼 */}
            <div className="flex items-center justify-between mb-1 pb-2 border-b border-gray-100">
              <span className="text-xs text-gray-400">요일별 시간을 개별로 조정하거나 기본 시간을 일괄 적용하세요</span>
              <button
                onClick={() => {
                  const targets = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
                  setDayHours(prev => {
                    const next = { ...prev };
                    targets.forEach(k => {
                      next[k] = { ...prev[k], open: globalOpen, close: globalClose, closed: false };
                    });
                    return next;
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors shrink-0 ml-3"
              >
                <CopyCheck size={13} />
                전체 기본 시간 적용
              </button>
            </div>

            {DAYS.map(({ key, label }) => (
              <div key={key} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${dayHours[key].closed ? 'bg-gray-50 opacity-60' : 'bg-white border border-gray-100'}`}>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                  key === 'sun' ? 'bg-red-100 text-red-600' :
                  key === 'sat' ? 'bg-blue-100 text-blue-600' :
                  'bg-gray-100 text-gray-600'
                }`}>{label}</span>

                <input
                  type="time"
                  value={dayHours[key].open}
                  onChange={e => setDay(key, 'open', e.target.value)}
                  disabled={dayHours[key].closed}
                  className="flex-1 text-sm font-medium bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                />
                <span className="text-gray-300 text-xs">~</span>
                <input
                  type="time"
                  value={dayHours[key].close}
                  onChange={e => setDay(key, 'close', e.target.value)}
                  disabled={dayHours[key].closed}
                  className="flex-1 text-sm font-medium bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                />

                <button
                  onClick={() => setDay(key, 'closed', !dayHours[key].closed)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    dayHours[key].closed
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {dayHours[key].closed ? '휴무' : '영업'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 메뉴판 테마 ──────────────────────────────────────────────────── */}
      <Section title="메뉴판 테마" icon={Palette} color="text-purple-500">
        {/* 프리셋 */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-600 mb-3">프리셋 테마</p>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_THEMES.map(p => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all hover:scale-105 ${
                  theme.primaryColor === p.primary
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                }`}
              >
                <div className="flex gap-0.5 shrink-0">
                  <div className="w-3 h-6 rounded-l-md" style={{ background: p.primary }} />
                  <div className="w-3 h-6 rounded-r-md" style={{ background: p.secondary }} />
                </div>
                <span className="text-xs font-bold text-gray-700 truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 색상 커스텀 */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-600 mb-3">색상 커스텀</p>
          <div className="space-y-3 bg-gray-50 rounded-xl p-4">
            <ColorField
              label="주 색상 (버튼·강조)"
              value={theme.primaryColor}
              onChange={v => setTheme(t => ({ ...t, primaryColor: v }))}
            />
            <ColorField
              label="보조 색상 (헤더·배경)"
              value={theme.secondaryColor}
              onChange={v => setTheme(t => ({ ...t, secondaryColor: v }))}
            />
            <ColorField
              label="포인트 색상 (뱃지·태그)"
              value={theme.accentColor}
              onChange={v => setTheme(t => ({ ...t, accentColor: v }))}
            />
            <ColorField
              label="배경 색상"
              value={theme.backgroundColor}
              onChange={v => setTheme(t => ({ ...t, backgroundColor: v }))}
            />
          </div>
        </div>

        {/* 폰트 */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            <Type size={14} /> 폰트
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FONTS.map(f => (
              <button
                key={f.value}
                onClick={() => setTheme(t => ({ ...t, fontFamily: f.value }))}
                className={`px-4 py-3 rounded-xl text-sm text-left transition-all border-2 ${
                  theme.fontFamily === f.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                    : 'border-gray-100 text-gray-600 hover:border-gray-200'
                }`}
                style={{ fontFamily: f.value }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 레이아웃 */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            <Layout size={14} /> 메뉴 레이아웃
          </p>
          <div className="grid grid-cols-3 gap-2">
            {LAYOUTS.map(l => (
              <button
                key={l.value}
                onClick={() => setTheme(t => ({ ...t, layoutMode: l.value }))}
                className={`p-3 rounded-xl text-center transition-all border-2 ${
                  theme.layoutMode === l.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-100 text-gray-600 hover:border-gray-200'
                }`}
              >
                <p className="font-bold text-sm">{l.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{l.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 미리보기 */}
        <div>
          <p className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
            <Brush size={14} /> 미리보기
          </p>
          <div
            className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
            style={{ backgroundColor: theme.backgroundColor, fontFamily: theme.fontFamily }}
          >
            <div className="px-4 py-3 flex items-center gap-2" style={{ background: theme.secondaryColor }}>
              <Store size={14} className="text-white/70" />
              <span className="text-white text-sm font-bold">매장명</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: theme.primaryColor, color: '#fff' }}>
                OPEN
              </span>
            </div>
            <div className="p-4">
              <div className={`grid gap-3 ${theme.layoutMode === 'list' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {[1, 2, 3, 4].slice(0, theme.layoutMode === 'magazine' ? 2 : 4).map(i => (
                  <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                    <div className="w-full h-16 rounded-lg mb-2" style={{ background: `${theme.primaryColor}20` }} />
                    <p className="text-xs font-bold text-gray-800">메뉴 {i}</p>
                    <p className="text-xs mt-1 font-bold" style={{ color: theme.primaryColor }}>₩12,000</p>
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full text-white font-bold" style={{ background: theme.accentColor }}>
                      인기
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 등급 설정 ────────────────────────────────────────────────────── */}
      <Section title="등급 설정" icon={Award} color="text-orange-500">
        <p className="text-sm text-slate-400 mb-4">고객 누적 구매액에 따라 자동 적용될 등급을 설정하세요. 등급별로 적립률을 다르게 적용할 수 있습니다.</p>

        {/* 등급 목록 */}
        {tiers.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl mb-4">
            <Icon icon="Award" />
            <p className="text-sm text-gray-400">등록된 등급이 없습니다</p>
            <p className="text-xs text-gray-300 mt-1">새 등급을 추가해주세요</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {tiers.map((tier) => (
              <div key={tier.tier_name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shrink-0">
                  <Icon icon="Award" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm">{tier.tier_name}</p>
                  <p className="text-xs text-gray-500">
                    최소 <span className="font-bold text-gray-700">{tier.min_spent?.toLocaleString()}원</span> 이상 · 적립 <span className="font-bold text-orange-600">{tier.earn_rate}%</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEditTier(tier)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors" title="수정">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDeleteTier(tier.tier_name)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors" title="삭제">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 등록/수정 폼 */}
        {showTierForm && (
          <div className="p-4 bg-white border-2 border-orange-100 rounded-xl mb-4 space-y-3">
            <p className="text-sm font-bold text-gray-700">
              {editingTier ? '등급 수정' : '새 등급 추가'}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-bold">등급명</label>
                <input
                  type="text"
                  value={tierForm.tier_name}
                  onChange={e => setTierForm(f => ({ ...f, tier_name: e.target.value }))}
                  placeholder="예: GOLD"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-orange-500"
                  disabled={!!editingTier}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-bold">최소 구매액 (원)</label>
                <input
                  type="number"
                  value={tierForm.min_spent}
                  onChange={e => setTierForm(f => ({ ...f, min_spent: parseInt(e.target.value) || 0 }))}
                  placeholder="100000"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-bold">적립률 (%)</label>
                <input
                  type="number"
                  value={tierForm.earn_rate}
                  onChange={e => setTierForm(f => ({ ...f, earn_rate: parseFloat(e.target.value) || 0 }))}
                  placeholder="5.0"
                  step="0.1"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleTierSubmit}
                disabled={tierSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {tierSaving ? '저장 중...' : (editingTier ? '수정 완료' : '등급 추가')}
              </button>
              <button
                onClick={() => { setShowTierForm(false); setEditingTier(null); setTierForm({ tier_name: 'GOLD', min_spent: 100000, earn_rate: 5.0 }); }}
                className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 새 등급 추가 버튼 */}
        {!showTierForm && (
          <button
            onClick={() => setShowTierForm(true)}
            className="flex items-center gap-2 w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:border-orange-300 hover:text-orange-500 transition-colors justify-center"
          >
            <Plus size={16} />
            새 등급 추가
          </button>
        )}
      </Section>

      {/* 하단 저장 버튼 (고정) */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-white/90 backdrop-blur-sm border-t border-gray-100 flex justify-end max-w-2xl mx-auto z-10">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-200"
        >
          {saving
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <CheckCircle2 size={16} />
          }
          {saving ? '저장 중...' : '변경사항 저장'}
        </button>
      </div>
    </div>
  );
}
