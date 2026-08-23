import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Globe, CloudRain, Sun, Snowflake, Flame, Type, ToggleLeft, ToggleRight, RefreshCw, TrendingUp, ShoppingCart, ChevronRight, Info, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { loadTinkerBellSettings, saveTinkerBellSettings } from '../utils/tinkerbell';
import TinkerBell from '../components/ai/TinkerBell';
import Icon from '../components/ui/Icon';

// ── 데모용 메뉴 데이터 (미리보기용) ─────────────────────────────────────────
const PREVIEW_MENU = [
  { id:1, name:'시그니처 라떼',   cat:'coffee',  isPopular:true,  isSoldOut:false },
  { id:2, name:'말차 라떼',       cat:'non-coffee', isPopular:true, isSoldOut:false },
  { id:3, name:'자몽 에이드',     cat:'ade',     isPopular:true,  isSoldOut:false },
  { id:4, name:'크렘 브륄레',     cat:'dessert', isPopular:false, isSoldOut:false },
  { id:5, name:'아메리카노',      cat:'coffee',  isPopular:true,  isSoldOut:false },
  { id:6, name:'복숭아 아이스티', cat:'ade',     isPopular:false, isSoldOut:true  },
];

const PREVIEW_ITEMS = [
  { name:'시그니처 라떼', price:6500, emoji:'☕' },
  { name:'말차 라떼',     price:5500, emoji:'🍵' },
  { name:'자몽 에이드',   price:5500, emoji:'🍊' },
  { name:'크렘 브륄레',   price:6500, emoji:'🍮' },
];

// ── 통계 카드 (목 데이터) ────────────────────────────────────────────────────
const STATS = [
  { label:'이번 달 추천 건수',    value:'1,247',  delta:'+18%', icon: Sparkles,    color:'from-amber-500 to-orange-500',    bg:'bg-amber-50',    txt:'text-amber-600' },
  { label:'추천 후 주문 전환율',  value:'64.3%',  delta:'+5.2%',icon: 'TrendingUp',  color:'from-emerald-500 to-teal-500',   bg:'bg-emerald-50',  txt:'text-emerald-600' },
  { label:'평균 추가 주문 메뉴',  value:'1.8개',  delta:'+0.3', icon: ShoppingCart, color:'from-sky-500 to-blue-500',       bg:'bg-sky-50',      txt:'text-sky-600' },
  { label:'큰 글씨 모드 사용',    value:'24.1%',  delta:'+3.1%',icon: Type,         color:'from-purple-500 to-violet-500',  bg:'bg-purple-50',   txt:'text-purple-600' },
];

// ── 언어 옵션 ────────────────────────────────────────────────────────────────
const LANGS = [
  { code:'ko', label:'한국어', flag:'🇰🇷' },
  { code:'en', label:'English', flag:'🇺🇸' },
  { code:'ja', label:'日本語', flag:'🇯🇵' },
  { code:'zh', label:'中文', flag:'🇨🇳' },
];

// ── 날씨/상황 옵션 ────────────────────────────────────────────────────────────
const WEATHERS = [
  { code:'sun',  label:'맑음',  icon: Sun,       color:'text-amber-500'  },
  { code:'rain', label:'비',    icon: CloudRain,  color:'text-blue-500'   },
  { code:'cold', label:'추위',  icon: Snowflake,  color:'text-cyan-500'   },
  { code:'hot',  label:'더위',  icon: Flame,      color:'text-red-500'    },
];

// ── 폰 프레임 미리보기 ────────────────────────────────────────────────────────
function PhonePreview({ lang, weather, voiceEnabled, largeFont, triggerKey, lastAddedItem, aiRecEnabled, previewStoreId }) {
   return (
     <div className="relative mx-auto" style={{ width: 280, height: 560 }}>
      {/* 폰 외곽선 */}
      <div className="absolute inset-0 rounded-[2.8rem] border-[10px] border-slate-900 bg-white shadow-2xl shadow-slate-900/40 overflow-hidden">
        {/* 노치 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900 rounded-b-2xl z-10" />

        {/* 화면 콘텐츠 */}
        <div className="absolute inset-0 bg-slate-50 pt-6 overflow-hidden">
          {/* 헤더 */}
          <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex items-center gap-2 shadow-sm">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center flex-shrink-0">
              <Sparkles size={10} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-slate-900 truncate">위마켓 시그니처 카페</p>
              <p className="text-[9px] text-orange-500 font-bold">A-07번 테이블</p>
            </div>
          </div>

          {/* 메뉴 아이템 */}
          <div className="p-3 space-y-2">
            {PREVIEW_ITEMS.map(item => (
              <div key={item.name} className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-sm border border-slate-100">
                <span className="text-lg">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-slate-900 truncate ${largeFont ? 'text-sm' : 'text-xs'}`}>{item.name}</p>
                  <p className={`text-slate-400 font-medium ${largeFont ? 'text-xs' : 'text-[10px]'}`}>{item.price.toLocaleString()}원</p>
                </div>
                <button className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-black flex-shrink-0">+</button>
              </div>
            ))}
          </div>

          {/* 팅커벨 오버레이 */}
<TinkerBell
             lang={lang}
             weather={weather}
             menuItems={PREVIEW_MENU}
             voiceEnabled={voiceEnabled}
             largeFont={largeFont}
             mode="preview"
             previewTrigger={triggerKey}
             lastAddedItem={lastAddedItem}
             storeId={aiRecEnabled && previewStoreId ? Number(previewStoreId) : null}
             adminMode
           />
        </div>
      </div>

      {/* 홈 버튼 */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-4 border-slate-900 bg-slate-800" />
    </div>
  );
}

// ── 토글 ──────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange, label, desc }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-slate-900">{label}</p>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => onChange(!on)} className="flex-shrink-0">
        {on
          ? <ToggleRight size={32} className="text-orange-500" />
          : <ToggleLeft  size={32} className="text-slate-300"  />}
      </button>
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────
export default function TinkerBellManagerPage() {
  const initial = loadTinkerBellSettings();
const [enabled,      setEnabled]      = useState(initial.enabled);
   const [lang,         setLang]         = useState(initial.lang);
   const [weather,      setWeather]      = useState('sun');
   const [voiceEnabled, setVoiceEnabled] = useState(initial.voiceEnabled);
   const [largeFont,    setLargeFont]    = useState(initial.largeFont);
   const [triggerKey,   setTriggerKey]   = useState(0);
   const [lastAdded,    setLastAdded]    = useState(null);
   const [customMsg,    setCustomMsg]    = useState(initial.customMsg);
   const [aiRecEnabled, setAiRecEnabled] = useState(initial.aiRecommendation ?? true);
   const [activeTab,    setActiveTab]    = useState('settings');
   const [saving,       setSaving]       = useState(false);
   const [previewStoreId, setPreviewStoreId] = useState('');

  const replay = () => setTriggerKey(k => k + 1);

  // 설정 저장 (localStorage 영속화)
const handleSave = () => {
     setSaving(true);
     const ok = saveTinkerBellSettings({ enabled, lang, voiceEnabled, largeFont, customMsg, aiRecommendation: aiRecEnabled, aiModel: 'omniroute' });
     toast[ok ? 'success' : 'error'](ok ? '팅커벨 설정이 저장되었습니다.' : '설정 저장에 실패했습니다.');
     setSaving(false);
   };

  const demoAdd = (item) => {
    setLastAdded({ name: item.name });
    setTimeout(() => setLastAdded(null), 100);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">AI 팅커벨 도우미</h1>
              <p className="text-xs text-slate-400 font-medium">고객 메뉴 AI 안내 도우미 설정 및 분석</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black ${enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {enabled ? '활성화' : '비활성화'}
            </div>
            <button
              onClick={replay}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors">
              <RefreshCw size={13} />
              미리보기 재시작
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-black hover:bg-orange-600 transition-colors disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              설정 저장
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="max-w-7xl mx-auto mt-4 flex gap-1">
          {['settings','analytics'].map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
              {tab === 'settings' ? '⚙️  설정 및 미리보기' : '📊  인터랙션 분석'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── 설정 탭 ──────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeTab === 'settings' && (
            <motion.div key="settings"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">

              {/* 설정 패널 */}
              <div className="space-y-5">

                {/* 활성화 */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                  <Toggle
                    on={enabled}
                    onChange={setEnabled}
                    label="AI 팅커벨 도우미 활성화"
                    desc="고객 메뉴 화면에 AI 안내 요정이 표시됩니다"
                  />
                  {!enabled && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-2xl text-xs text-slate-500 border border-slate-100">
                        <Info size={13} className="flex-shrink-0" />
                        비활성화 시 고객 메뉴 화면에 팅커벨이 표시되지 않습니다.
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* 기본 언어 */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe size={16} className="text-slate-600" />
                    <h3 className="text-sm font-black text-slate-900">기본 인사 언어</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {LANGS.map(l => (
                      <button key={l.code} onClick={() => setLang(l.code)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold border-2 transition-all ${lang === l.code ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        <span className="text-base">{l.flag}</span>
                        {l.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
                    <Info size={11} />
                    고객이 실제 화면에서 언어를 변경하면 팅커벨이 자동으로 해당 언어로 인사합니다.
                  </p>
                </div>

                {/* 날씨/상황 컨텍스트 */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Sun size={16} className="text-amber-500" />
                    <h3 className="text-sm font-black text-slate-900">날씨/상황별 추천 컨텍스트 미리보기</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {WEATHERS.map(w => {
                      const Icon = w.icon;
                      return (
                        <button key={w.code} onClick={() => setWeather(w.code)}
                          className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold border-2 transition-all ${weather === w.code ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                          <Icon size={15} className={weather === w.code ? 'text-white' : w.color} />
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
                    <Info size={11} />
                    실제 서비스에서는 날씨 API와 연동하여 자동으로 상황에 맞는 메뉴를 추천합니다.
                  </p>
                </div>

{/* AI 추천 설정 */}
                 <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
                   <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                     <Sparkles size={14} className="text-amber-500" />
                     AI 추천 설정
                   </h3>
                   <Toggle
                     on={aiRecEnabled}
                     onChange={setAiRecEnabled}
                     label="AI 기반 동적 추천 활성화"
                     desc="OmniRoute AI가 날씨, 시간, 고객 이력을 기반으로 메뉴를 추천합니다"
                   />
                   {aiRecEnabled && (
                     <div>
                       <p className="text-xs text-slate-400 mb-2">미리보기용 매장 ID (선택사항)</p>
                       <input
                         type="text"
                         value={previewStoreId}
                         onChange={e => setPreviewStoreId(e.target.value)}
                         placeholder="매장 ID를 입력하면 AI 추천을 미리볼 수 있습니다"
                         className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                       />
                     </div>
                   )}
                 </div>

                 {/* 접근성 설정 */}
                 <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
                   <h3 className="text-sm font-black text-slate-900">접근성 옵션</h3>
                  <Toggle
                    on={voiceEnabled}
                    onChange={setVoiceEnabled}
                    label="음성 안내"
                    desc="Web Speech API를 이용해 팅커벨 대사를 음성으로 읽어드립니다"
                  />
                  <div className="h-px bg-slate-100" />
                  <Toggle
                    on={largeFont}
                    onChange={setLargeFont}
                    label="큰 글씨 모드"
                    desc="말풍선 텍스트를 크게 표시합니다 (고령층 고객 배려)"
                  />
                </div>

                {/* 커스텀 인삿말 */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-1">커스텀 인삿말 <span className="text-xs font-normal text-slate-400 ml-1">미출시 기능</span></h3>
                  <p className="text-xs text-slate-400 mb-3">매장만의 특별한 인삿말을 설정할 수 있습니다</p>
                  <textarea
                    rows={3}
                    value={customMsg}
                    onChange={e => setCustomMsg(e.target.value)}
                    placeholder="예: 안녕하세요! 오늘의 특선 메뉴는 말차 라떼입니다 ☕"
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl resize-none text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-400">{customMsg.length}/80자</span>
                    <span className="text-xs text-slate-300">준비 중 — 추후 업데이트 예정</span>
                  </div>
                </div>

                {/* 데모: 장바구니 반응 테스트 */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-3">장바구니 반응 테스트</h3>
                  <p className="text-xs text-slate-400 mb-4">버튼을 눌러 팅커벨이 장바구니 추가에 어떻게 반응하는지 미리보기에서 확인하세요</p>
                  <div className="flex flex-wrap gap-2">
                    {PREVIEW_ITEMS.map(item => (
                      <button key={item.name}
                        onClick={() => demoAdd(item)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-100 text-orange-700 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors">
                        <span>{item.emoji}</span>
                        {item.name} 담기
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 미리보기 패널 */}
              <div className="xl:sticky xl:top-20 xl:self-start space-y-4">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">실시간 미리보기</h3>
                      <p className="text-xs text-slate-400 mt-0.5">고객 화면 시뮬레이션</p>
                    </div>
                    <button onClick={replay}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors">
                      <RefreshCw size={11} />
                      재시작
                    </button>
                  </div>

{enabled
                     ? <PhonePreview lang={lang} weather={weather} voiceEnabled={voiceEnabled} largeFont={largeFont} triggerKey={triggerKey} lastAddedItem={lastAdded} aiRecEnabled={aiRecEnabled} previewStoreId={previewStoreId} />
                     : (
                      <div className="mx-auto" style={{ width: 280, height: 420 }}>
                        <div className="w-full h-full rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 text-slate-400">
                          <Sparkles size={28} className="opacity-30" />
                          <p className="text-sm font-bold">팅커벨 비활성화 중</p>
                          <p className="text-xs text-center px-6">활성화 토글을 켜면<br />미리보기가 표시됩니다</p>
                        </div>
                      </div>
                    )}
                </div>

                {/* 현재 설정 요약 */}
                <div className="bg-slate-900 rounded-3xl p-5 text-sm space-y-2.5">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">현재 설정</p>
                  {[
                    { label:'언어', value: LANGS.find(l => l.code === lang)?.label },
                    { label:'컨텍스트', value: WEATHERS.find(w => w.code === weather)?.label },
                    { label:'음성 안내', value: voiceEnabled ? 'ON' : 'OFF' },
                    { label:'큰 글씨', value: largeFont ? 'ON' : 'OFF' },
                    { label:'상태', value: enabled ? '활성화' : '비활성화', highlight: enabled },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">{row.label}</span>
                      <span className={`font-black ${row.highlight ? 'text-emerald-400' : 'text-white'}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── 분석 탭 ──────────────────────────────────────────────── */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-6">

              {/* 안내 배너 */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-6 text-white">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Sparkles size={22} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black mb-1">AI 팅커벨 ROI 분석</h2>
                    <p className="text-white/80 text-sm leading-relaxed">
                      팅커벨의 추천이 실제 주문으로 이어진 비율과 고객 경험 지표를 확인하세요.<br />
                      <span className="font-bold">데모 데이터</span>입니다 — 실제 매장 연동 시 실시간 집계됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* KPI 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {STATS.map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-4 shadow-lg`}>
                        <Icon size={18} className="text-white" />
                      </div>
                      <p className="text-3xl font-black text-slate-900">{s.value}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
                      <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-black ${s.bg} ${s.txt}`}>
                        <TrendingUp size={10} />
                        {s.delta} 전월 대비
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 인기 추천 메뉴 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-4">팅커벨 추천 TOP 5</h3>
                  <div className="space-y-3">
                    {[
                      { name:'시그니처 라떼',   count:384, rate:'71%' },
                      { name:'아메리카노',      count:271, rate:'58%' },
                      { name:'말차 라떼',       count:198, rate:'64%' },
                      { name:'자몽 에이드',     count:156, rate:'52%' },
                      { name:'크렘 브륄레',     count:134, rate:'69%' },
                    ].map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-slate-900 truncate">{item.name}</span>
                            <span className="text-xs font-black text-orange-500 ml-2">{item.rate}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className="bg-gradient-to-r from-orange-500 to-rose-500 h-1.5 rounded-full" style={{ width: item.rate }} />
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 font-medium flex-shrink-0">{item.count}건</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-4">시간대별 팅커벨 활동</h3>
                  <div className="space-y-2">
                    {[
                      { time:'08:00 – 10:00', label:'모닝 러시',  bar:'45%',  count: 62 },
                      { time:'11:00 – 13:00', label:'런치 피크',  bar:'100%', count:143 },
                      { time:'14:00 – 16:00', label:'오후 여유',  bar:'72%',  count:103 },
                      { time:'17:00 – 19:00', label:'이브닝',     bar:'88%',  count:126 },
                      { time:'19:00 – 21:00', label:'디너 타임',  bar:'60%',  count: 85 },
                    ].map(row => (
                      <div key={row.time} className="flex items-center gap-3">
                        <div className="w-24 flex-shrink-0">
                          <p className="text-[10px] font-black text-slate-900">{row.label}</p>
                          <p className="text-[9px] text-slate-400">{row.time}</p>
                        </div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-2 rounded-full" style={{ width: row.bar }} />
                        </div>
                        <span className="text-xs text-slate-500 font-medium w-12 text-right flex-shrink-0">{row.count}건</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Info size={12} />
                      런치 피크타임에 팅커벨 활동이 가장 활발합니다
                    </div>
                  </div>
                </div>
              </div>

              {/* 언어별 사용 분포 */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 mb-4">언어별 이용 고객 분포</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { lang:'ko', label:'한국어', flag:'🇰🇷', pct:74, color:'bg-orange-500' },
                    { lang:'en', label:'English', flag:'🇺🇸', pct:14, color:'bg-blue-500' },
                    { lang:'ja', label:'日本語', flag:'🇯🇵', pct: 8, color:'bg-red-500' },
                    { lang:'zh', label:'中文',   flag:'🇨🇳', pct: 4, color:'bg-emerald-500' },
                  ].map(l => (
                    <div key={l.lang} className="text-center">
                      <div className="text-3xl mb-1">{l.flag}</div>
                      <p className="text-2xl font-black text-slate-900">{l.pct}%</p>
                      <p className="text-xs text-slate-400 font-medium">{l.label}</p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                        <div className={`${l.color} h-1.5 rounded-full`} style={{ width: `${l.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="bg-slate-900 rounded-3xl p-7 flex items-center justify-between gap-6 flex-wrap">
                <div>
                  <h3 className="text-lg font-black text-white">팅커벨로 매출을 높이세요</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    평균 주문당 <span className="text-amber-400 font-black">+1.8개</span> 추가 메뉴 · 신규 회원 전환율 <span className="text-emerald-400 font-black">+24%</span>
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all whitespace-nowrap">
                  설정 바로가기
                  <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
