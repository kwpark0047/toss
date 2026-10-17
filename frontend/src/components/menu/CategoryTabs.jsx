import { motion } from 'framer-motion';
import { vibrateClick } from '../../utils/notificationSound';

/**
 * CategoryTabs — TDS 카테고리 선택
 * - 카테고리 3개 이하: SegmentedControl (필 슬라이드) — 적은 고정 선택지에 적합
 * - 4개 이상: Tab (언더라인 + 가로 스크롤) — 가변/다수 카테고리에 적합
 * 헤더(h-14=56px) 바로 아래에 sticky 배치.
 * TDS 준수: 타입 스케일, 간격, 아이콘 시스템
 */
const CategoryTabs = ({ categories, selectedCategory, onSelectCategory }) => {
  const useSegmented = categories.length <= 3;

  if (useSegmented) {
    return (
      <div className="sticky top-14 z-30 cust-bg-base border-b cust-border px-4 py-2">
        <div role="group" aria-label="메뉴 카테고리" className="mx-auto flex max-w-2xl gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
          {categories.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => { vibrateClick(); onSelectCategory(category); }}
                aria-pressed={isActive}
                className="relative flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {isActive && (
                  <motion.div
                    layoutId="segActive"
                    className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span className={`relative z-10 tds-text-bold text-sm transition-colors ${isActive ? 'cust-text-main' : 'text-slate-500 dark:text-slate-500'}`}>
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
    <div className="sticky top-14 z-30 cust-bg-base backdrop-blur-md border-b cust-border overflow-x-auto no-scrollbar">
      <div role="group" aria-label="메뉴 카테고리" className="mx-auto flex min-w-max max-w-6xl items-center gap-1 px-2 sm:px-6 lg:px-8 h-14">
        {categories.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => { vibrateClick(); onSelectCategory(category); }}
              aria-pressed={isActive}
              className="relative flex min-h-11 items-center justify-center px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className={`tds-text-bold text-sm transition-colors ${isActive ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`}>
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

