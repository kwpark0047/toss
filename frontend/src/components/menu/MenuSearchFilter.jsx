import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * MenuSearchFilter — 손님 메뉴판 검색 + 알레르기 제외 필터
 * - 검색어가 있으면 카테고리와 무관하게 전체 메뉴에서 찾는다 (MenuPage 에서 처리)
 * - 알레르기 칩은 매장이 실제로 등록한 항목만 노출하고, 등록된 항목이 없으면 숨긴다
 */
const MenuSearchFilter = ({ query, onQueryChange, allergens = [], excludedAllergens = [], onToggleAllergen }) => {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('menu.search_placeholder')}
          aria-label={t('menu.search_placeholder')}
          className="min-h-11 w-full rounded-xl border cust-border cust-bg-card pl-9 pr-10 text-sm cust-text-main placeholder:text-slate-400 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label={t('menu.search_clear')}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {allergens.length > 0 && (
        <div className="mt-3">
          <p id="menu-allergen-filter-label" className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {t('menu.allergen_filter_label')}
          </p>
          <div role="group" aria-labelledby="menu-allergen-filter-label" className="mt-1.5 flex flex-wrap gap-1.5">
            {allergens.map((label) => {
              const active = excludedAllergens.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleAllergen(label)}
                  className={`min-h-9 rounded-full border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active
                      ? 'border-amber-500 bg-amber-50 text-amber-800 line-through dark:bg-amber-500/15 dark:text-amber-200'
                      : 'cust-border cust-bg-card text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {excludedAllergens.length > 0 && (
            <p role="status" className="mt-2 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
              {t('menu.allergen_disclaimer')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MenuSearchFilter;
