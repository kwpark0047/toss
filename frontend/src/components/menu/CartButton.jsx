import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import Button from '../common/Button';

const CartButton = ({ totalItems, totalPrice, onClick }) => {
  const formatPrice = (price) => new Intl.NumberFormat('ko-KR').format(price) + '원';

  return (
    <AnimatePresence>
      {totalItems > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-40 px-4"
        >
          <Button variant="primary" size="md" fullWidth layout="between" onClick={onClick} className="shadow-primary/30">
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-white text-primary text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-primary">
                  {totalItems}
                </span>
              </div>
              <span className="text-sm">장바구니 보기</span>
            </div>
            <span className="text-sm font-black">{formatPrice(totalPrice)}</span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CartButton;
