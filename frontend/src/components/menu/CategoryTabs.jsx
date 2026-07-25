import { motion } from 'framer-motion';
import { vibrateClick } from '../../utils/notificationSound';

/**
 * CategoryTabs — TDS 카테고리 선택.
 * - 카테고리 3개 이하: SegmentedControl (필 슬라이드) — 적은 고정 선택지에 적합
 * - 4개 이상: Tab (언더라인 + 가로 스크롤) — 가변/다수 카테고리에 적합
 * 헤더(h-14=56px) 바로 아래에 sticky 배치.
 */
const CategoryTabs = ({ categories, selectedCategory, onSelectCategory }) => {
  const useSegmented = categories.length <= 3;

  if (useSegmented) {
    return (
      <div className="sticky top-14 z-30 cust-bg-base px-4 pt-3 pb-2">
        <div className="relative flex bg-slate-100 dark:bg-white/5 rounded-xl p-1">
          {categories.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => { vibrateClick(); onSelectCategory(category); }}
                className="relative flex-1 h-9 flex items-center justify-center rounded-lg"
              >
                {isActive && (
                  <motion.div
                    layoutId="segActive"
                    className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span className={`relative z-10 text-sm font-bold transition-colors ${isActive ? 'cust-text-main' : 'text-slate-500 dark:text-slate-500'}`}>
                  {category}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Tab (언더라인 + 가로 스크롤)
  return (
    <div className="sticky top-14 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-100 dark:border-white/5 overflow-x-auto no-scrollbar">
      <div className="px-2 flex items-center gap-0.5 min-w-max h-12">
        {categories.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => { vibrateClick(); onSelectCategory(category); }}
              className="relative px-3.5 h-full flex items-center justify-center transition-colors"
            >
              <span className={`text-sm transition-colors ${isActive ? 'text-primary font-bold' : 'text-slate-500 font-medium dark:text-slate-400'}`}>
                {category}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeCategory"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryTabs;
