import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';

const CartButton = ({ totalItems, totalPrice, onClick }) => {
  const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price) + '원';

  return (
    <AnimatePresence>
      {totalItems > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-0 right-0 z-40 px-6"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="w-full max-w-lg mx-auto bg-primary text-white h-14 rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-between px-6 font-bold"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-6 h-6" />
                <span className="absolute -top-2 -right-2 bg-white text-primary text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-primary">
                  {totalItems}
                </span>
              </div>
              <span>장바구니 보기</span>
            </div>
            <span className="text-lg">{formatPrice(totalPrice)}</span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartButton;
