import { motion } from 'framer-motion';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { vibrateClick } from '../../utils/notificationSound';
import LanguageSwitcher from '../common/LanguageSwitcher';
import Icon from '../ui/Icon';

/**
 * MenuHeader — TDS Top/Navigation 패턴 (3분할: leading · center title · trailing)
 * 좌우 액션 영역을 동일 폭(44px)으로 두어 중앙 타이틀이 정확히 가운데 정렬된다.
 * TDS 준수: Icon 래퍼, 타입 스케일, 간격 유틸
 */
const MenuHeader = ({ storeName, tableNumber, onOrderHistoryClick, onCallStaffClick }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-100 dark:border-white/5">
      <div className="tds-stack-h tds-gap-2 h-14 tds-p-1 tds-p-4 grid grid-cols-[40px_1fr_40px_40px] items-center">
        {/* Leading — 뒤로가기 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { vibrateClick(); navigate(-1); }}
          aria-label={t('menu_header.back')}
          className="w-10 h-10 tds-stack items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <Icon icon="ChevronLeft" size="md" color="muted" />
        </motion.button>

        {/* Center — 타이틀 + 서브타이틀 (중앙 정렬, 넘치면 말줄임) */}
        <div className="min-w-0 text-center tds-p-1 tds-stack flex-col items-center justify-center">
          <div className="tds-stack-h tds-gap-2 items-center justify-center max-w-full">
            <h1 className="tds-text-bold cust-text-main truncate">{storeName}</h1>
            {onCallStaffClick && (
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => { vibrateClick(); onCallStaffClick(); }}
                className="tds-p-1 tds-p-2.5 bg-primary hover:bg-primary/90 text-white rounded-full tds-small tds-text-bold tracking-wider transition-all active:scale-95 shrink-0 tds-stack-h tds-gap-1 shadow-md shadow-primary/10 h-6"
              >
                <span>{t('menu_header.call_staff')}</span>
              </motion.button>
            )}
          </div>
          {tableNumber && (
            <p className="tds-caption text-primary truncate">{t('menu_header.table', { number: tableNumber })}</p>
          )}
        </div>

        {/* Trailing — 주문 내역 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { vibrateClick(); onOrderHistoryClick(); }}
          aria-label={t('menu_header.order_history')}
          className="w-10 h-10 tds-stack items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-slate-300"
        >
          <Icon icon="History" size="md" color="muted" />
        </motion.button>

        {/* Language Switcher */}
        <LanguageSwitcher />
      </div>
    </header>
  );
};

export default MenuHeader;