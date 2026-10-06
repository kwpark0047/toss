import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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

  return (
    <motion.header
      initial={false}
      animate={{ y: showHeader ? 0 : -headerHeight }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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

    </motion.header>
  );
};

export default MenuHeader;
