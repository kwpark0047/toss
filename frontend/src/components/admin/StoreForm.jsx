import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { storesAPI, planRequestsAPI } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreOperatingHours } from '../../hooks/useStoreOperatingHours';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, Palette, Type, Crown, Zap, Building2, Clock, CheckCircle, XCircle, ChefHat, Info, Smartphone, Layout, MapPin, Phone } from 'lucide-react';
import Icon from '../ui/Icon';

const defaultTheme = {
  primaryColor: '#f97316',
  secondaryColor: '#1e3a5f',
  accentColor: '#10b981',
  backgroundColor: '#f8fafc',
  textColor: '#1e293b',
  fontFamily: 'Pretendard',
  logoText: ''
};

const fontOptions = [
  { value: 'Pretendard', label: 'Pretendard (기본)' },
  { value: 'Noto Sans KR', label: 'Noto Sans KR' },
  { value: 'Nanum Gothic', label: '나눔고딕' },
  { value: 'Spoqa Han Sans Neo', label: 'Spoqa Han Sans' }
];

const presetThemes = [
  { name: '오렌지', primary: '#f97316', secondary: '#1e3a5f', accent: '#10b981' },
  { name: '오션', primary: '#3b82f6', secondary: '#1e293b', accent: '#f59e0b' },
  { name: '에메랄드', primary: '#10b981', secondary: '#064e3b', accent: '#f97316' },
  { name: '미드나잇', primary: '#8b5cf6', secondary: '#1e1b4b', accent: '#ec4899' },
  { name: '크림슨', primary: '#ef4444', secondary: '#1f2937', accent: '#fbbf24' },
  { name: '사이버펑크', primary: '#ec4899', secondary: '#4a044e', accent: '#06b6d4' }
];

const planOptions = [
  { value: 'free', label: 'Free', desc: '매장 1개, 기본 기능', icon: 'Building2', color: 'text-slate-400', bg: 'bg-slate-400/10' },
  { value: 'pro', label: 'Pro', desc: '매장 5개, 고급 분석', icon: 'Zap', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { value: 'enterprise', label: 'Enterprise', desc: '무제한 매장, 전담 지원', icon: Crown, color: 'text-orange-400', bg: 'bg-orange-400/10' }
];

const StoreForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const isSuperAdmin = user?.role === 'super_admin';

  const [form, setForm] = useState({
    name: '', description: '', address: '', phone: '',
    business_type: 'cafe', open_time: '09:00', close_time: '22:00',
    plan: 'free', can_send_sms: false, operatingHours: { usePerDay: false, hours: {} }
  });
  const [theme, setTheme] = useState(defaultTheme);
  const [activeTab, setActiveTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [planRequests, setPlanRequests] = useState([]);
  const [requestPlan, setRequestPlan] = useState('pro');
  const [requestReason, setRequestReason] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');

  useEffect(() => {
    if (isEdit) {
      storesAPI.getById(id).then((res) => {
        const s = res.data;
        
        // 새 매장 생성: 기본값 유지
        if (!id) {
          setForm(prev => ({
            ...prev,
            open_time: '09:00',
            close_time: '22:00',
          }));
          if (s.theme) {
            try {
              const parsed = typeof s.theme === 'string' ? JSON.parse(s.theme) : s.theme;
              setTheme({ ...defaultTheme, ...parsed });
            } catch (e) { console.error(e); }
          }
          if (!isSuperAdmin) {
            planRequestsAPI.getByStore(id).then(pr => setPlanRequests(pr.data || [])).catch(() => { });
          }
          return;
        }
        
        // 기존 매장 편집 모드: basic 영업시간 기본값 유지, operatingHours 필드만 추가
        setForm(prev => ({
          ...prev,
          operatingHours: { usePerDay: false, hours: {} }
        }));
        
        if (s.theme) {
          try {
            const parsed = typeof s.theme === 'string' ? JSON.parse(s.theme) : s.theme;
            setTheme({ ...defaultTheme, ...parsed });
          } catch (e) { console.error(e); }
        }
        if (!isSuperAdmin) {
          planRequestsAPI.getByStore(id).then(pr => setPlanRequests(pr.data || [])).catch(() => { });
        }
      }).catch(() => navigate('/admin'));
    }
  }, [id, isEdit, navigate, isSuperAdmin]);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleThemeChange = (key, value) => setTheme((p) => ({ ...p, [key]: value }));
  const applyPreset = (preset) => setTheme((p) => ({ ...p, primaryColor: preset.primary, secondaryColor: preset.secondary, accentColor: preset.accent }));

  const handlePlanRequest = async () => {
    setRequestLoading(true);
    setError('');
    setRequestSuccess('');
    try {
      await planRequestsAPI.create({
        store_id: id,
        requested_plan: requestPlan,
        reason: requestReason
      });
      setRequestSuccess('플랜 업그레이드 신청이 접수되었습니다!');
      setRequestReason('');
      const pr = await planRequestsAPI.getByStore(id);
      setPlanRequests(pr.data || []);
    } catch (err) {
      setError(err.message || '신청에 실패했습니다');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = { ...form, theme: JSON.stringify(theme) };
      if (isEdit) await storesAPI.update(id, data);
      else await storesAPI.create(data);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || '저장에 실패했습니다');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pb-20">
      <motion.button 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate(-1)} 
        className="group flex items-center gap-3 text-slate-400 hover:text-white mb-10 font-bold transition-colors"
      >
        <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center group-hover:bg-orange-500/10 group-hover:border-orange-500/50 transition-all">
          <ArrowLeft size={20} />
        </div>
        대시보드로 돌아가기
      </motion.button>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 shrink-0 space-y-2">
          {[
            { id: 'info', label: '매장 정보', icon: Info },
            { id: 'theme', label: '디자인 시스템', icon: Palette },
            { id: 'plan', label: '서비스 플랜', icon: Crown, hide: isSuperAdmin || !isEdit }
          ].filter(t => !t.hide).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-xs tracking-widest transition-all ${
                activeTab === tab.id 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 translate-x-2' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-8">
          <motion.div 
            layout
            className="bg-white/5 backdrop-blur-2xl rounded-[40px] border border-white/5 shadow-2xl overflow-hidden"
          >
            <form className="p-10" onSubmit={handleSubmit}>
              <h2 className="text-3xl font-black text-white tracking-tight mb-8">
                {isEdit ? '매장 정보 고도화' : '신규 매장 런칭'}
              </h2>
              
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-8 p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center gap-4 text-rose-400 font-bold"
                  >
                    <XCircle size={24} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

                {activeTab === 'info' && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Icon icon="Building2" /> 매장명
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          required
                          className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-700 outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all"
                          placeholder="매장 이름을 입력하세요"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <ChefHat size={14} className="text-orange-500" /> 업종 분류
                        </label>
                        <select
                          name="business_type"
                          value={form.business_type}
                          onChange={handleChange}
                          className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-orange-500/50 appearance-none transition-all"
                        >
                          <option value="cafe" className="bg-slate-900">카페</option>
                          <option value="restaurant" className="bg-slate-900">레스토랑</option>
                          <option value="bar" className="bg-slate-900">바 / 펍</option>
                          <option value="bakery" className="bg-slate-900">베이커리</option>
                          <option value="fastfood" className="bg-slate-900">패스트푸드</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Icon icon="MapPin" /> 매장 주소
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={form.address || ''}
                        onChange={handleChange}
                        className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-700 outline-none focus:border-orange-500/50 transition-all"
                        placeholder="전체 주소를 입력하세요"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Phone size={14} className="text-orange-500" /> 연락처
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={form.phone || ''}
                          onChange={handleChange}
                          className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-700 outline-none focus:border-orange-500/50 transition-all"
                          placeholder="010-0000-0000"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">영업 시작</label>
                          <input type="time" aria-label="영업 시작 시간" name="open_time" value={form.open_time} onChange={handleChange} className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none appearance-none transition-all" />
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">영업 종료</label>
                          <input type="time" aria-label="영업 종료 시간" name="close_time" value={form.close_time} onChange={handleChange} className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none appearance-none transition-all" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Layout size={14} className="text-orange-500" /> 매장 소개
                      </label>
                      <textarea
                        name="description"
                        value={form.description || ''}
                        onChange={handleChange}
                        rows={4}
                        className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-700 outline-none focus:border-orange-500/50 transition-all resize-none"
                        placeholder="고객에게 매장을 소개해주세요..."
                      />
                    </div>

                    {isSuperAdmin && (
                      <div className="pt-8 border-t border-white/5">
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
                              <Smartphone size={24} />
                            </div>
                            <div>
                              <p className="font-black text-white text-sm">SMS 마케팅 권한</p>
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter mt-1">매장 관리자가 고객에게 SMS 알림을 발송할 수 있도록 허용</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setForm(p => ({ ...p, can_send_sms: !p.can_send_sms }))}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${form.can_send_sms ? 'bg-blue-500' : 'bg-slate-700'}`}
                          >
                            <motion.span
                              animate={{ x: form.can_send_sms ? 24 : 4 }}
                              className="inline-block h-5 w-5 rounded-full bg-white shadow-lg"
                            />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'plan' && !isSuperAdmin && isEdit && (
                  <motion.div
                    key="plan"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-10"
                  >
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[40px] p-10 border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px] -mr-32 -mt-32" />
                      <div className="relative z-10 flex items-center justify-between gap-10">
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">현재 활성 플랜</p>
                          <h3 className="text-4xl font-black text-white uppercase tracking-tight">{form.plan || 'FREE'}</h3>
                        </div>
                        <div className="w-24 h-24 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center text-orange-500 shadow-2xl">
                          <Icon icon="Crown" />
                        </div>
                      </div>
                    </div>

                    {planRequests.some(r => r.status === 'pending') ? (
                      <div className="p-8 bg-amber-500/10 border border-amber-500/20 rounded-[32px] flex items-center gap-6">
                        <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500">
                          <Clock size={28} className="animate-pulse" />
                        </div>
                        <div>
                          <p className="font-black text-white text-lg">업그레이드 검토 중</p>
                          <p className="text-sm font-bold text-slate-500 mt-1 uppercase">
                            {planRequests.find(r => r.status === 'pending')?.requested_plan.toUpperCase()} 플랜 업그레이드 요청이 처리 중입니다
                          </p>
                        </div>
                      </div>
                    ) : form.plan !== 'enterprise' && (
                      <div className="space-y-8">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">프리미엄 플랜 선택</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {planOptions.filter(p => p.value !== 'free' && p.value !== form.plan).map((plan) => (
                            <button
                              key={plan.value}
                              type="button"
                              onClick={() => setRequestPlan(plan.value)}
                              className={`group p-8 rounded-[32px] border-2 transition-all text-left relative overflow-hidden ${
                                requestPlan === plan.value
                                ? 'border-orange-500 bg-orange-500/5 shadow-2xl shadow-orange-500/10'
                                : 'border-white/5 bg-white/2 hover:border-white/20'
                              }`}
                            >
                              <div className={`w-14 h-14 ${plan.bg} ${plan.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                <plan.icon size={28} />
                              </div>
                              <p className="text-2xl font-black text-white mb-2">{plan.label}</p>
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter leading-relaxed">{plan.desc}</p>
                              {requestPlan === plan.value && (
                                <div className="absolute top-6 right-6 text-orange-500">
                                  <CheckCircle size={24} />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">업그레이드 사유</label>
                          <textarea
                            value={requestReason}
                            onChange={(e) => setRequestReason(e.target.value)}
                            placeholder="비즈니스 요구사항을 알려주세요..."
                            rows={3}
                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-700 outline-none focus:border-orange-500/50 transition-all resize-none"
                          />
                        </div>

                        {requestSuccess && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-[32px] flex items-center gap-4 text-emerald-400 font-black"
                          >
                            <CheckCircle size={24} />
                            {requestSuccess}
                          </motion.div>
                        )}

                        <button
                          type="button"
                          onClick={handlePlanRequest}
                          disabled={requestLoading}
                          className="w-full h-16 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-2xl font-black text-sm tracking-[0.2em] shadow-2xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {requestLoading ? '처리 중...' : `${requestPlan.toUpperCase()} 업그레이드 신청`}
                        </button>
                      </div>
                    )}

              </motion.div>
            )}

                {activeTab === 'theme' && (
                  <motion.div
                    key="theme"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-12"
                  >
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 block">프리셋 테마</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                        {presetThemes.map((preset, idx) => (
                          <button 
                            key={idx} 
                            type="button" 
                            onClick={() => applyPreset(preset)} 
                            className="group p-5 bg-white/5 rounded-3xl border border-white/5 hover:border-orange-500/30 transition-all text-center"
                          >
                            <div className="flex justify-center -space-x-2 mb-4 group-hover:scale-110 transition-transform">
                              <div className="w-8 h-8 rounded-full border-2 border-slate-900 shadow-xl" style={{ backgroundColor: preset.primary }} />
                              <div className="w-8 h-8 rounded-full border-2 border-slate-900 shadow-xl" style={{ backgroundColor: preset.secondary }} />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">{preset.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-8">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">색상 시스템</label>
                        {[
                          { key: 'primaryColor', label: '기본 색상' },
                          { key: 'secondaryColor', label: '보조 색상' },
                          { key: 'accentColor', label: '강조 색상' }
                        ].map(item => (
                          <div key={item.key} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                            <input 
                              type="color" aria-label={`${item.label} 색상 선택`} 
                              value={theme[item.key]} 
                              onChange={(e) => handleThemeChange(item.key, e.target.value)} 
                              className="w-14 h-14 rounded-xl cursor-pointer bg-transparent border-0" 
                            />
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1">{item.label}</p>
                              <input 
                                type="text" aria-label={`${item.label} 색상 코드`} 
                                value={theme[item.key]} 
                                onChange={(e) => handleThemeChange(item.key, e.target.value)} 
                                className="w-full bg-transparent text-white font-black uppercase text-sm outline-none" 
                              />
                            </div>
                          </div>
                        ))}
                        
                        <div className="pt-4">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">폰트 종류</label>
                          <div className="relative">
                            <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <select 
                              value={theme.fontFamily} 
                              onChange={(e) => handleThemeChange('fontFamily', e.target.value)} 
                              className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none appearance-none"
                            >
                              {fontOptions.map(f => <option key={f.value} value={f.value} className="bg-slate-900">{f.label}</option>)}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">브랜드 로고 텍스트</label>
                          <input
                            type="text"
                            value={theme.logoText}
                            onChange={(e) => handleThemeChange('logoText', e.target.value)}
                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-orange-500/50 transition-all"
                            placeholder="로고에 표시할 텍스트 입력"
                          />
                        </div>
                      </div>

                      {/* 실시간 미리보기 */}
                      <div className="space-y-6">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">실시간 모바일 미리보기</label>
                        <div className="relative mx-auto w-[320px] aspect-[9/18] bg-slate-900 rounded-[3rem] border-[12px] border-slate-800 shadow-2xl overflow-hidden ring-4 ring-white/5">
                          {/* 스크린 내부 */}
                          <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: theme.backgroundColor, fontFamily: theme.fontFamily }}>
                            <div className="p-8 pb-4">
                              <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-2xl" style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})` }}>
                                  {(theme.logoText || form.name || 'W').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-black text-xl truncate" style={{ color: theme.textColor }}>{theme.logoText || form.name || 'Store Name'}</h3>
                                  <p className="text-[10px] opacity-60 font-bold truncate uppercase tracking-tighter" style={{ color: theme.textColor }}>{form.description || 'Modern dining experience'}</p>
                                </div>
                              </div>

                              <div className="flex gap-2 mb-8 overflow-x-hidden">
                                <span className="px-4 py-2 rounded-full text-white text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: theme.primaryColor }}>Signature</span>
                                <span className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/80 border" style={{ color: theme.secondaryColor }}>Main Menu</span>
                              </div>

                              <div className="bg-white rounded-[2rem] p-5 shadow-xl flex justify-between items-center border border-black/5">
                                <div className="flex-1">
                                  <p className="font-black text-sm" style={{ color: theme.textColor }}>Premium Signature</p>
                                  <p className="text-[10px] opacity-60 font-bold mt-0.5" style={{ color: theme.textColor }}>Crafted with passion</p>
                                </div>
                                <span className="font-black text-lg" style={{ color: theme.primaryColor }}>$24</span>
                              </div>
                            </div>
                            
                            <div className="mt-auto p-8 pt-0">
                              <button type="button" className="w-full py-4 rounded-2xl text-white font-black text-xs tracking-[0.2em] shadow-2xl" style={{ backgroundColor: theme.primaryColor }}>
                                ADD TO CART
                              </button>
                            </div>
                          </div>
                          
                          {/* 카메라 노치 */}
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-3xl flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-slate-700 mx-1" />
                            <div className="w-12 h-1 rounded-full bg-slate-700 mx-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100">
              <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 bg-gray-100 text-slate-700 rounded-xl font-medium hover:bg-gray-200">취소</button>
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-3 btn-primary text-white rounded-xl font-medium shadow-lg disabled:opacity-50">
                <Save size={18} />{loading ? '저장 중...' : '저장'}
              </button>
            </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default StoreForm;
