import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * MenuHeader — TDS Top/Navigation 패턴 (3분할: leading · center title · trailing)
 * 좌우 액션 영역을 동일 폭(44px)으로 두어 중앙 타이틀이 정확히 가운데 정렬된다.
 */
const MenuHeader = ({ storeName, tableNumber, onOrderHistoryClick }) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/85 backdrop-blur-md border-b border-slate-100">
      <div className="h-14 px-1.5 grid grid-cols-[44px_1fr_44px] items-center">
        {/* Leading — 뒤로가기 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          aria-label="뒤로 가기"
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </motion.button>

        {/* Center — 타이틀 + 서브타이틀 (중앙 정렬, 넘치면 말줄임) */}
        <div className="min-w-0 text-center px-1">
          <h1 className="tds-subtitle text-grey-900 truncate">{storeName}</h1>
          {tableNumber && (
            <p className="tds-caption text-primary truncate">{tableNumber}번 테이블</p>
          )}
        </div>

        {/* Trailing — 주문 내역 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onOrderHistoryClick}
          aria-label="주문 내역"
          className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-700"
        >
          <History className="w-5 h-5" />
        </motion.button>
      </div>
    </header>
  );
};

export default MenuHeader;
