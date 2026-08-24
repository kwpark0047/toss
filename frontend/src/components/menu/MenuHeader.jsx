import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { vibrateClick } from '../../utils/notificationSound';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Icon from '../../components/ui/Icon';

/**
 * MenuHeader — TDS Top/Navigation 패턴 + 메뉴바 숨기기/펼치기 기능
 * - 헤더 상단 슬라이드 업/다운 애니메이션
 * - 헤더 숨김 시 상세 메뉴 화면 슬라이드 다운
 * - TDS 준수: Icon 래퍼, 타입 스케일, 간격 유틸, TDS 네비게이션 패턴
 * - 스크롤 방향 감지 자동 숨김/표시 (선택사항)
 */
const MenuHeader = ({ 
  storeName, 
  tableNumber, 
  onOrderHistoryClick, 
  onCallStaffClick,
  showHeader = true,
  onToggleHeader,
  headerHeight = 70,
  onHeaderHeightChange
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // 헤더 높이 모션 값
  const headerY = useMotionValue(0);
  const headerOpacity = useSpring(headerY, { 
    stiffness: 300, 
    damping: 30,
    restDelta: 0.01 
  });
  const headerScale = useSpring(headerY, { 
    stiffness: 300, 
    damping: 30 
  });

  // 헤더 높이 변화 감지 및 콜백
  useEffect(() => {
    if (onHeaderHeightChange) {
      const height = showHeader ? headerHeight : 0;
      onHeaderHeightChange(height);
    }
  }, [showHeader, headerHeight, onHeaderHeightChange]);

  // 헤더 표시/숨김 토글
  const toggleHeader = () => {
    vibrateClick();
    if (onToggleHeader) {
      onToggleHeader(!showHeader);
    }
  };

  // 헤더 높이 애니메이션
  useEffect(() => {
    const targetY = showHeader ? 0 : -headerHeight;
    headerY.spring(targetY, { 
      stiffness: 400, 
      damping: 30,
      restDelta: 0.5
    });
  }, [showHeader, headerHeight, headerY]);

  return (
    <motion.header
      style={{ 
        y: headerY, 
        opacity: headerOpacity,
        scale: headerScale
      }}
      initial={false}
      animate={false}
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        showHeader ? 'bg-white/85 dark:bg-slate-900/85' : 'bg-transparent'
      }`}
    >
      {/* 헤더 바 - 항상 표시되는 토글 버튼 영역 */}
      <div className={`w-full ${showHeader ? 'bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-100 dark:border-white/5' : 'bg-transparent'}`}>
        <div className="h-14 px-1 grid grid-cols-[40px_1fr_40px_40px] items-center">
          {/* Leading — 뒤로가기/메뉴 토글 */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={showHeader ? (() => { vibrateClick(); navigate(-1); }) : toggleHeader}
            aria-label={showHeader ? t('menu_header.back') : t('menu_header.show_menu')}
            className="w-10 h-10 tds-stack items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <Icon 
              icon={showHeader ? "ChevronLeft" : "Menu"} 
              size="md" 
              color="muted" 
            />
          </motion.button>

          {/* Center — 타이틀 + 서브타이틀 (중앙 정렬, 넘치면 말줄임) */}
          <div className="min-w-0 text-center tds-p-1 tds-stack flex-col items-center justify-center">
            <div className="tds-stack-h tds-gap-2 items-center justify-center max-w-full">
              <h1 className="tds-text-bold cust-text-main truncate">{storeName}</h1>
              {onCallStaffClick && (
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={() => { vibrateClick(); onCallStaffClick(); }}
                  className="tds-p-1 tds-p-2.5 bg-primary hover:bg-primary/90 text-white rounded-full tds-small tds-text-bold tracking-wider transition-all active:scale-95 shrink-0 flex items-center gap-1 shadow-md shadow-primary/10 h-6"
                >
                  <span>{t('menu_header.call_staff')}</span>
                </motion.button>
              )}
            </div>
            {tableNumber && (
              <p className="tds-caption text-primary truncate">{t('menu_header.table', { number: tableNumber })}</p>
            )}
          </div>

          {/* Trailing — 주문 내역 / 메뉴 토글 */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={showHeader ? (() => { vibrateClick(); onOrderHistoryClick(); }) : toggleHeader}
            aria-label={showHeader ? t('menu_header.order_history') : t('menu_header.show_menu')}
            className="w-10 h-10 tds-stack items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-slate-300"
          >
            <Icon 
              icon={showHeader ? "History" : "Menu"} 
              size="md" 
              color="muted" 
            />
          </motion.button>

          {/* Language Switcher - 헤더가 보일 때만 */}
          {showHeader && <LanguageSwitcher />}
        </div>
      </div>

      {/* 헤더가 숨겨졌을 때 나타나는 미니 탭 바 */}
      {!showHeader && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 px-2 py-1"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="tds-stack-h tds-gap-2 justify-center">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleHeader}
              className="tds-stack-h tds-gap-2 tds-p-2 tds-p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-100 dark:border-white/10 shadow-lg shadow-slate-900/10"
            >
              <Icon icon="Menu" />
              <span className="tds-small font-bold">{t('menu_header.show_menu')}</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { vibrateClick(); navigate(-1); }}
              className="tds-p-2 tds-p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-100 dark:border-white/10 shadow-lg"
            >
              <Icon icon="ChevronLeft" />
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* 헤더가 보일 때만 표시되는 상세 메뉴 섹션 (슬라이드 다운) */}
      <AnimatePresence>
        {showHeader && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-white/5"
          >
            {/* AI 추천 입력 섹션 */}
            <div className="px-5 pb-5 overflow-hidden">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 shadow-2xl shadow-blue-200">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <Icon icon="Sparkles" />
                  {t('menu.ai_recommend')}
                </h3>
                <form onSubmit={handleGetRecommendations} className="relative group">
                  <input 
                    type="text" 
                    value={aiPreferences} 
                    onChange={e => setAiPreferences(e.target.value)} 
                    placeholder={t('common.search_placeholder') || "선호하는 맛이나 메뉴를 입력하세요..."} 
                    className="w-full h-14 pl-5 pr-14 rounded-2xl text-sm outline-none bg-white/10 text-white placeholder:text-white/50 border border-white/20 focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400 transition-all shadow-inner" 
                  />
                  <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                    {moodTags.map(tag => <button 
                      key={tag.value} 
                      type="button" 
                      onClick={() => setMood(tag.value)} 
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${mood === tag.value ? "bg-white text-blue-600 shadow-lg" : "bg-white/10 text-white border border-white/20"}`}
                    >
                      <span>{tag.icon}</span>
                      {tag.label}
                    </button>)}
                  </div>
                  <motion.button 
                    whileTap={{ scale: 0.9 }} 
                    type="submit" 
                    disabled={aiLoading} 
                    className="absolute right-1.5 top-1.5 bottom-1.5 w-11 bg-white text-blue-600 rounded-xl flex items-center justify-center disabled:opacity-50 shadow-lg group-focus-within:bg-blue-600 group-focus-within:text-white transition-colors"
                  >
                    {aiLoading ? <div className="w-5 h-5 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" /> : <Icon icon="Search" />}
                  </motion.button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI 추천 결과 캐러셀 - 헤더가 보일 때만 */}
      <AnimatePresence>
        {showHeader && aiRecommendations.length > 0 && (
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="px-5 pb-5 overflow-x-auto scrollbar-hide"
          >
            <div className="flex gap-4 pb-2">
              {aiRecommendations.map((rec, idx) => <motion.div 
                key={rec.id} 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: idx * 0.1, type: 'spring', stiffness: 400, damping: 30 }}
                className="min-w-[300px] glass-panel p-4 flex gap-4 card-hover border-blue-100/50"
              >
                <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-md">
                  <img src={rec.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop'} alt={rec.name} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <h4 className="tds-text-bold text-base truncate">{rec.name}</h4>
                    <p className="tds-caption text-blue-600 font-bold mt-1 line-clamp-2 leading-snug">✨ {rec.recommend_reason}</p>
                  </div>
                  <div className="tds-stack-h tds-gap-2 items-center justify-between mt-2">
                    <span className="tds-text-bold text-sm" style={{ color: theme.primaryColor }}>{formatPrice(rec.price)}</span>
                    <motion.button 
                      whileTap={{ scale: 0.9 }} 
                      onClick={() => addToCart(rec)} 
                      className="tds-p-1 tds-p-2 bg-blue-600 text-white rounded-xl tds-small tds-text-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                    >
                      {t('menu.add_cart')}
                    </motion.button>
                  </div>
                </div>
              </motion.div>)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default MenuHeader;