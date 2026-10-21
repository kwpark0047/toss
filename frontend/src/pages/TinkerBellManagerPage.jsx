import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { adminAPI } from '../api/admin';
import { DEFAULT_TINKERBELL_SETTINGS, fromServerTinkerBellSettings, toServerTinkerBellSettings } from '../utils/tinkerbell';
import TinkerBell from '../components/ai/TinkerBell';
import Icon from '../components/ui/Icon';
import { BarChart3, ChevronRight, Globe, Info, RefreshCw, Sparkles, Sun, TrendingUp, ShoppingCart, Type, CloudRain, Snowflake, Flame } from 'lucide-react';

// ── 데모용 메뉴 데이터 (미리보기용) ─────────────────────────────────────────
// TinkerBell의 날씨별 추천 필터가 category_id / isHot / isCold 를 본다
const PREVIEW_MENU = [
  { id:1, name:'시그니처 라떼',   category_id:'coffee',     isHot:true,  isPopular:true,  isSoldOut:false },
  { id:2, name:'말차 라떼',       category_id:'non-coffee', isHot:true,  isPopular:true,  isSoldOut:false },
  { id:3, name:'자몽 에이드',     category_id:'ade',        isCold:true, isPopular:true,  isSoldOut:false },
  { id:4, name:'크렘 브륄레',     category_id:'dessert',                 isPopular:false, isSoldOut:false },
  { id:5, name:'아메리카노',      category_id:'coffee',     isHot:true,  isPopular:true,  isSoldOut:false },
  { id:6, name:'복숭아 아이스티', category_id:'ade',        isCold:true, isPopular:false, isSoldOut:true  },
];

const PREVIEW_ITEMS = [
  { name:'시그니처 라떼', price:6500, emoji:'☕' },
  { name:'말차 라떼',     price:5500, emoji:'🍵' },
  { name:'자몽 에이드',   price:5500, emoji:'🍊' },
  { name:'크렘 브륄레',   price:6500, emoji:'🍮' },
];

// ── 통계 카드 (목 데이터) ────────────────────────────────────────────────────
const STATS = [
  { label:'이번 달 추천 건수',    value:'1,247',  delta:'+18%', icon: Sparkles,     tone:'bg-amber-500/10 text-amber-400' },
  { label:'추천 후 주문 전환율',  value:'64.3%',  delta:'+5.2%',icon: TrendingUp,   tone:'bg-emerald-500/10 text-emerald-400' },
  { label:'평균 추가 주문 메뉴',  value:'1.8개',  delta:'+0.3', icon: ShoppingCart, tone:'bg-sky-500/10 text-sky-400' },
  { label:'큰 글씨 모드 사용',    value:'24.1%',  delta:'+3.1%',icon: Type,         tone:'bg-violet-500/10 text-violet-400' },
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
  { code:'sun',  label:'맑음',  icon: Sun,        color:'text-amber-400' },
  { code:'rain', label:'비',    icon: CloudRain,  color:'text-blue-400'  },
  { code:'cold', label:'추위',  icon: Snowflake,  color:'text-cyan-400'  },
  { code:'hot',  label:'더위',  icon: Flame,      color:'text-red-400'   },
];

const CUSTOM_MSG_MAX = 80;

// 공용 관리자 스타일
const CARD = 'rounded-3xl bg-white/5 border border-white/10 p-6';
const INPUT = 'w-full px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:border-orange-500/50 focus-visible:ring-2 focus-visible:ring-orange-400/40 transition-all';
const GHOST_BTN = 'flex items-center gap-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl font-bold hover:bg-white/10 transition-colors';
const chipClass = (selected) =>
  `flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${selected
    ? 'bg-orange-500 text-white border-orange-500'
    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`;

const isValidStoreId = (v) => /^[1-9]\d*$/.test(String(v).trim());

// ── 폰 프레임 미리보기 ────────────────────────────────────────────────────────
// 고객 화면을 흉내 내므로 항상 밝은 화면이다. admin-dark-scope로 라이트 테마 오버라이드를 막아
// 말풍선(bg-slate-900 + text-white)이 라이트 테마에서도 읽히게 한다.
function PhonePreview({ lang, weather, voiceEnabled, largeFont, triggerKey, lastAddedItem, aiStoreId }) {
  return (
    <div className="admin-dark-scope relative mx-auto" style={{ width: 280, height: 560 }}>
      {/* 폰 외곽선 */}
      <div className="absolute inset-0 rounded-[2.8rem] border-[10px] border-slate-800 bg-white overflow-hidden">
        {/* 노치 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-b-2xl z-10" />

        {/* 화면 콘텐츠 */}
        <div className="absolute inset-0 bg-slate-50 pt-6 overflow-hidden">
          {/* 헤더 */}
          <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex items-center gap-2 shadow-sm">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center flex-shrink-0">
              <Icon icon="Sparkles" size="sm" className="text-white" />
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
                  <p className={`text-slate-500 font-medium ${largeFont ? 'text-xs' : 'text-[10px]'}`}>{item.price.toLocaleString()}원</p>
                </div>
                <span aria-hidden="true" className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-black flex-shrink-0">+</span>
              </div>
            ))}
          </div>

          {/* 팅커벨 오버레이 — 고객 화면과 같은 대사·추천 흐름을 보여준다 */}
          <TinkerBell
            lang={lang}
            weather={weather}
            menuItems={PREVIEW_MENU}
            voiceEnabled={voiceEnabled}
            largeFont={largeFont}
            mode="preview"
            previewTrigger={triggerKey}
            lastAddedItem={lastAddedItem}
            storeId={aiStoreId}
          />
        </div>
      </div>

      {/* 홈 버튼 */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-4 border-slate-800 bg-slate-700" />
    </div>
  );
}

// ── 토글 ──────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange, label, desc }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        {desc && <p className="text-xs text-slate-400 mt-0.5">{desc}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label}
        onClick={() => onChange(!on)}
        className="flex-shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-400/40">
        {on
          ? <Icon icon="ToggleRight" size="lg" className="text-orange-500" />
          : <Icon icon="ToggleLeft" size="lg" className="text-slate-500" />}
      </button>
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────
export default function TinkerBellManagerPage() {
  const { storeId: routeStoreId } = useParams();
  const navigate = useNavigate();
  const storeId = isValidStoreId(routeStoreId ?? '') ? Number(routeStoreId) : null;
  const [loadState,    setLoadState]    = useState(storeId ? 'loading' : 'idle'); // idle | loading | ready | error
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(DEFAULT_TINKERBELL_SETTINGS);
  const [enabled,      setEnabled]      = useState(saved.enabled);
  const [lang,         setLang]         = useState(saved.lang);
  const [weather,      setWeather]      = useState('sun');
  const [voiceEnabled, setVoiceEnabled] = useState(saved.voiceEnabled);
  const [largeFont,    setLargeFont]    = useState(saved.largeFont);
  const [triggerKey,   setTriggerKey]   = useState(0);
  const [lastAdded,    setLastAdded]    = useState(null);
  const [customMsg,    setCustomMsg]    = useState(saved.customMsg);
  const [aiRecEnabled, setAiRecEnabled] = useState(saved.aiRecommendation);
  const [activeTab,    setActiveTab]    = useState('settings');
  const [storeInput,   setStoreInput]   = useState('');
  const [reloadKey,    setReloadKey]    = useState(0);

  const applySettings = (s) => {
    setSaved(s);
    setEnabled(s.enabled);
    setLang(s.lang);
    setVoiceEnabled(s.voiceEnabled);
    setLargeFont(s.largeFont);
    setCustomMsg(s.customMsg || '');
    setAiRecEnabled(s.aiRecommendation);
  };

  // 매장 설정 불러오기
  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    setLoadState('loading');
    adminAPI.getTinkerbellSettings(storeId)
      .then(res => {
        if (cancelled) return;
        applySettings(fromServerTinkerBellSettings(res?.data || res));
        setLoadState('ready');
      })
      .catch(() => { if (!cancelled) setLoadState('error'); });
    return () => { cancelled = true; };
  }, [storeId, reloadKey]);

  const current = { ...saved, enabled, lang, voiceEnabled, largeFont, customMsg, aiRecommendation: aiRecEnabled };
  const dirty = ['enabled', 'lang', 'voiceEnabled', 'largeFont', 'customMsg', 'aiRecommendation']
    .some(k => (current[k] ?? '') !== (saved[k] ?? ''));
  const canSave = loadState === 'ready' && dirty && !saving;

  // AI 추천 미리보기는 서버에 저장된 설정이 ON일 때만 동작한다 (서버도 같은 기준으로 차단)
  const aiStoreId = storeId && saved.enabled && saved.aiRecommendation && aiRecEnabled ? storeId : null;
  const storeInputInvalid = storeInput.trim() !== '' && !isValidStoreId(storeInput);

  const replay = () => setTriggerKey(k => k + 1);

  const goToStore = (e) => {
    e.preventDefault();
    if (!isValidStoreId(storeInput)) return;
    navigate(`/admin/stores/${Number(storeInput)}/tinkerbell`);
  };

  // 설정 저장 (매장별 서버 저장 → 고객 메뉴 화면에 반영)
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await adminAPI.updateTinkerbellSettings(storeId, toServerTinkerBellSettings(current));
      applySettings(fromServerTinkerBellSettings(res?.data || res));
      toast.success('팅커벨 설정이 저장되었습니다. 고객 메뉴 화면에 바로 적용됩니다.');
    } catch (err) {
      toast.error(err?.response?.data?.error || '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const demoAdd = (item) => {
    setLastAdded({ name: item.name });
    setTimeout(() => setLastAdded(null), 100);
  };

  return (
    <div className="space-y-6 text-slate-200 max-w-7xl mx-auto p-1">
      {/* 상단 헤더 */}
      <div className="pb-6 border-b border-white/10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">AI 팅커벨 도우미</h1>
              <p className="text-xs text-slate-400 font-medium">고객 메뉴 AI 안내 도우미 설정 및 분석</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border ${enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-slate-400 border-white/10'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              {enabled ? '활성화' : '비활성화'}
            </div>
            <button type="button" onClick={replay} className={`${GHOST_BTN} px-4 py-2 text-sm`}>
              <RefreshCw size={13} />
              미리보기 재시작
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-black hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? <Icon icon="Loader2" size="md" className="animate-spin" /> : <Icon icon="Save" size="md" />}
              {saving ? '저장 중' : loadState === 'ready' && !dirty ? '저장됨' : '설정 저장'}
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div role="tablist" className="mt-4 flex gap-1">
          {['settings','analytics'].map(tab => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              {tab === 'settings' ? '⚙️  설정 및 미리보기' : '📊  인터랙션 분석'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <AnimatePresence mode="wait">
          {/* ── 설정 탭 ──────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <motion.div key="settings"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">

              {/* 설정 패널 */}
              <div className="space-y-5">

                {/* 대상 매장 */}
                {!storeId ? (
                  <form onSubmit={goToStore} className={`${CARD} space-y-3`}>
                    <div>
                      <h3 className="text-sm font-black text-white">설정할 매장 선택</h3>
                      <p className="text-xs text-slate-400 mt-0.5">팅커벨 설정은 매장마다 따로 저장됩니다. 매장 ID를 입력해 불러오세요.</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        aria-label="매장 ID"
                        type="text"
                        inputMode="numeric"
                        value={storeInput}
                        onChange={e => setStoreInput(e.target.value)}
                        placeholder="예: 12"
                        aria-invalid={storeInputInvalid}
                        className={INPUT}
                      />
                      <button type="submit" disabled={!isValidStoreId(storeInput)}
                        className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-black hover:bg-orange-600 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">
                        불러오기
                      </button>
                    </div>
                    {storeInputInvalid && <p className="text-xs text-red-400">매장 ID는 숫자로 입력해 주세요.</p>}
                    <p className="text-xs text-slate-500">매장을 고르기 전에도 아래에서 미리보기는 해볼 수 있지만 저장은 되지 않습니다.</p>
                  </form>
                ) : (
                  <div role="status" className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-400">
                    <span className="flex items-center gap-2">
                      <Info size={14} className="flex-shrink-0" />
                      {loadState === 'loading' && `${storeId}번 매장 설정을 불러오는 중입니다…`}
                      {loadState === 'ready' && `${storeId}번 매장 설정입니다. 저장하면 이 매장의 고객 메뉴 화면에 바로 적용됩니다.`}
                      {loadState === 'error' && <span className="text-red-400">{storeId}번 매장 설정을 불러오지 못했습니다. 저장하려면 다시 불러와 주세요.</span>}
                    </span>
                    {loadState === 'error' && (
                      <button type="button" onClick={() => setReloadKey(k => k + 1)} className={`${GHOST_BTN} px-3 py-1.5 text-xs`}>
                        <RefreshCw size={11} />
                        다시 불러오기
                      </button>
                    )}
                  </div>
                )}

                {/* 활성화 */}
                <div className={CARD}>
                  <Toggle
                    on={enabled}
                    onChange={setEnabled}
                    label="AI 팅커벨 도우미 활성화"
                    desc="고객 메뉴 화면에 AI 안내 요정이 표시됩니다"
                  />
                  {!enabled && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 bg-white/5 rounded-2xl text-xs text-slate-400 border border-white/10">
                        <Icon icon="Info" size="md" className="flex-shrink-0" />
                        비활성화 시 고객 메뉴 화면에 팅커벨이 표시되지 않습니다.
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* 기본 언어 */}
                <div className={CARD}>
                  <div className="flex items-center gap-2 mb-4">
                    <Globe size={16} className="text-slate-400" />
                    <h3 className="text-sm font-black text-white">기본 인사 언어</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {LANGS.map(l => (
                      <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}
                        className={chipClass(lang === l.code)}>
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
                <div className={CARD}>
                  <div className="flex items-center gap-2 mb-4">
                    <Sun size={16} className="text-amber-400" />
                    <h3 className="text-sm font-black text-white">날씨/상황별 추천 컨텍스트 미리보기</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {WEATHERS.map(w => {
                      const WeatherIcon = w.icon;
                      return (
                        <button key={w.code} type="button" aria-pressed={weather === w.code} onClick={() => setWeather(w.code)}
                          className={chipClass(weather === w.code)}>
                          <WeatherIcon size={15} className={weather === w.code ? undefined : w.color} />
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
                    <Info size={11} />
                    미리보기에서 약 11초 뒤 이 날씨에 맞는 추천 말풍선이 나옵니다. 실제 서비스는 매장 위치의 날씨를 자동으로 씁니다.
                  </p>
                </div>

                {/* AI 추천 설정 */}
                <div className={`${CARD} space-y-5`}>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-400" />
                    AI 추천 설정
                  </h3>
                  <Toggle
                    on={aiRecEnabled}
                    onChange={setAiRecEnabled}
                    label="AI 기반 동적 추천 활성화"
                    desc="OmniRoute AI가 날씨, 시간, 고객 이력을 기반으로 메뉴를 추천합니다"
                  />
                  <p className="text-xs text-slate-500">
                    {!aiRecEnabled
                      ? '꺼져 있으면 고객 화면에서 유료 AI를 호출하지 않고 기본 추천 문구만 보여줍니다. (기본값: 꺼짐)'
                      : aiStoreId
                        ? '미리보기에서 이 매장 메뉴로 AI 추천을 요청합니다. 추천 통계에는 기록되지 않습니다.'
                        : '켜면 고객이 메뉴 화면을 볼 때마다 AI 호출 비용이 생깁니다. 저장한 뒤 미리보기에서 AI 추천을 확인할 수 있습니다.'}
                  </p>
                </div>

                {/* 접근성 설정 */}
                <div className={`${CARD} space-y-5`}>
                  <h3 className="text-sm font-black text-white">접근성 옵션</h3>
                  <Toggle
                    on={voiceEnabled}
                    onChange={setVoiceEnabled}
                    label="음성 안내"
                    desc="Web Speech API를 이용해 팅커벨 대사를 음성으로 읽어드립니다"
                  />
                  <div className="h-px bg-white/10" />
                  <Toggle
                    on={largeFont}
                    onChange={setLargeFont}
                    label="큰 글씨 모드"
                    desc="말풍선 텍스트를 크게 표시합니다 (고령층 고객 배려)"
                  />
                </div>

                {/* 커스텀 인삿말 */}
                <div className={CARD}>
                  <h3 className="text-sm font-black text-white mb-1">커스텀 인삿말 <span className="text-xs font-normal text-slate-500 ml-1">미출시 기능</span></h3>
                  <p className="text-xs text-slate-400 mb-3">매장만의 특별한 인삿말을 설정할 수 있습니다</p>
                  <textarea
                    rows={3}
                    maxLength={CUSTOM_MSG_MAX}
                    value={customMsg}
                    onChange={e => setCustomMsg(e.target.value)}
                    placeholder="예: 안녕하세요! 오늘의 특선 메뉴는 말차 라떼입니다 ☕"
                    className={`${INPUT} rounded-2xl py-3 resize-none`}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-400">{customMsg.length}/{CUSTOM_MSG_MAX}자</span>
                    <span className="text-xs text-slate-500">준비 중 — 추후 업데이트 예정</span>
                  </div>
                </div>

                {/* 데모: 장바구니 반응 테스트 */}
                <div className={CARD}>
                  <h3 className="text-sm font-black text-white mb-3">장바구니 반응 테스트</h3>
                  <p className="text-xs text-slate-400 mb-4">버튼을 눌러 팅커벨이 장바구니 추가에 어떻게 반응하는지 미리보기에서 확인하세요</p>
                  <div className="flex flex-wrap gap-2">
                    {PREVIEW_ITEMS.map(item => (
                      <button key={item.name} type="button"
                        onClick={() => demoAdd(item)}
                        disabled={!enabled}
                        className={`${GHOST_BTN} px-4 py-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed`}>
                        <span>{item.emoji}</span>
                        {item.name} 담기
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 미리보기 패널 */}
              <div className="xl:sticky xl:top-20 xl:self-start space-y-4">
                <div className={CARD}>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-sm font-black text-white">실시간 미리보기</h3>
                      <p className="text-xs text-slate-400 mt-0.5">고객 화면 시뮬레이션</p>
                    </div>
                    <button type="button" onClick={replay} className={`${GHOST_BTN} gap-1.5 px-3 py-1.5 text-xs`}>
                      <RefreshCw size={11} />
                      재시작
                    </button>
                  </div>

                  {enabled
                    ? <PhonePreview lang={lang} weather={weather} voiceEnabled={voiceEnabled} largeFont={largeFont} triggerKey={triggerKey} lastAddedItem={lastAdded} aiStoreId={aiStoreId} />
                    : (
                      <div className="mx-auto" style={{ width: 280, height: 420 }}>
                        <div className="w-full h-full rounded-3xl bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 text-slate-400">
                          <Sparkles size={28} className="opacity-30" />
                          <p className="text-sm font-bold">팅커벨 비활성화 중</p>
                          <p className="text-xs text-center px-6">활성화 토글을 켜면<br />미리보기가 표시됩니다</p>
                        </div>
                      </div>
                    )}
                </div>

                {/* 현재 설정 요약 */}
                <div className="rounded-3xl bg-white/5 border border-white/10 p-5 text-sm space-y-2.5">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">현재 설정</p>
                  {[
                    { label:'언어', value: LANGS.find(l => l.code === lang)?.label },
                    { label:'컨텍스트', value: WEATHERS.find(w => w.code === weather)?.label },
                    { label:'AI 추천', value: aiRecEnabled ? 'ON' : 'OFF' },
                    { label:'음성 안내', value: voiceEnabled ? 'ON' : 'OFF' },
                    { label:'큰 글씨', value: largeFont ? 'ON' : 'OFF' },
                    { label:'상태', value: enabled ? '활성화' : '비활성화', highlight: enabled },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">{row.label}</span>
                      <span className={`font-black ${row.highlight ? 'text-emerald-400' : 'text-white'}`}>{row.value}</span>
                    </div>
                  ))}
                  {dirty && <p className="pt-2 text-xs font-bold text-orange-400">저장하지 않은 변경 사항이 있습니다</p>}
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
              <div className="rounded-3xl bg-orange-500/10 border border-orange-500/20 p-6">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Sparkles size={22} />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <h2 className="text-lg font-black text-white mb-1">AI 팅커벨 ROI 분석</h2>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      팅커벨의 추천이 실제 주문으로 이어진 비율과 고객 경험 지표를 확인하세요.<br />
                      아래 수치는 <span className="font-bold text-orange-400">예시 데이터</span>입니다.
                    </p>
                  </div>
                  {storeId && (
                    <Link to={`/admin/stores/${storeId}/recommendation-stats`}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-black hover:bg-orange-600 transition-colors whitespace-nowrap">
                      <BarChart3 size={14} />
                      {storeId}번 매장 실제 추천 성과
                    </Link>
                  )}
                </div>
              </div>

              {/* KPI 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {STATS.map(s => {
                  const StatIcon = s.icon;
                  return (
                    <div key={s.label} className={CARD}>
                      <div className={`w-11 h-11 rounded-2xl ${s.tone} flex items-center justify-center mb-4`}>
                        <StatIcon size={18} />
                      </div>
                      <p className="text-3xl font-black text-white">{s.value}</p>
                      <p className="text-xs text-slate-400 font-medium mt-1">{s.label}</p>
                      <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-400">
                        <TrendingUp size={10} />
                        {s.delta} 전월 대비
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 인기 추천 메뉴 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className={CARD}>
                  <h3 className="text-sm font-black text-white mb-4">팅커벨 추천 TOP 5</h3>
                  <div className="space-y-3">
                    {[
                      { name:'시그니처 라떼',   count:384, rate:'71%' },
                      { name:'아메리카노',      count:271, rate:'58%' },
                      { name:'말차 라떼',       count:198, rate:'64%' },
                      { name:'자몽 에이드',     count:156, rate:'52%' },
                      { name:'크렘 브륄레',     count:134, rate:'69%' },
                    ].map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-white/5 text-slate-400 text-xs font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-white truncate">{item.name}</span>
                            <span className="text-xs font-black text-orange-400 ml-2">{item.rate}</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-1.5">
                            <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: item.rate }} />
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 font-medium flex-shrink-0">{item.count}건</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={CARD}>
                  <h3 className="text-sm font-black text-white mb-4">시간대별 팅커벨 활동</h3>
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
                          <p className="text-[10px] font-black text-white">{row.label}</p>
                          <p className="text-[9px] text-slate-500">{row.time}</p>
                        </div>
                        <div className="flex-1 bg-white/10 rounded-full h-2">
                          <div className="bg-amber-500 h-2 rounded-full" style={{ width: row.bar }} />
                        </div>
                        <span className="text-xs text-slate-400 font-medium w-12 text-right flex-shrink-0">{row.count}건</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Info size={12} />
                      런치 피크타임에 팅커벨 활동이 가장 활발합니다
                    </div>
                  </div>
                </div>
              </div>

              {/* 언어별 사용 분포 */}
              <div className={CARD}>
                <h3 className="text-sm font-black text-white mb-4">언어별 이용 고객 분포</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { lang:'ko', label:'한국어', flag:'🇰🇷', pct:74, color:'bg-orange-500' },
                    { lang:'en', label:'English', flag:'🇺🇸', pct:14, color:'bg-blue-500' },
                    { lang:'ja', label:'日本語', flag:'🇯🇵', pct: 8, color:'bg-red-500' },
                    { lang:'zh', label:'中文',   flag:'🇨🇳', pct: 4, color:'bg-emerald-500' },
                  ].map(l => (
                    <div key={l.lang} className="text-center">
                      <div className="text-3xl mb-1">{l.flag}</div>
                      <p className="text-2xl font-black text-white">{l.pct}%</p>
                      <p className="text-xs text-slate-400 font-medium">{l.label}</p>
                      <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                        <div className={`${l.color} h-1.5 rounded-full`} style={{ width: `${l.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-3xl bg-white/5 border border-white/10 p-7 flex items-center justify-between gap-6 flex-wrap">
                <div>
                  <h3 className="text-lg font-black text-white">팅커벨로 매출을 높이세요</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    평균 주문당 <span className="text-amber-400 font-black">+1.8개</span> 추가 메뉴 · 신규 회원 전환율 <span className="text-emerald-400 font-black">+24%</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold text-sm hover:bg-orange-600 transition-colors whitespace-nowrap">
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
