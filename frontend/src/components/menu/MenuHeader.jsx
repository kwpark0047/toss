import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, ChevronLeft, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MenuHeader = ({ storeName, tableNumber, onOrderHistoryClick }) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">{storeName}</h1>
            <p className="text-xs text-primary font-medium">{tableNumber}번 테이블</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOrderHistoryClick}
            className="p-2.5 hover:bg-slate-100 rounded-full transition-colors relative text-slate-600"
          >
            <History className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </header>
  );
};

export default MenuHeader;
