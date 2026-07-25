import { SlidersHorizontal, ChevronDown, Heart, RefreshCw, Grid3X3, List, Map as MapIcon } from 'lucide-react';

const regions = [
  { id: 'all', name: '전체 지역' },
  { id: 'seoul', name: '서울' },
  { id: 'gyeonggi', name: '경기' },
  { id: 'incheon', name: '인천' },
  { id: 'busan', name: '부산' },
  { id: 'daegu', name: '대구' },
  { id: 'daejeon', name: '대전' },
  { id: 'gwangju', name: '광주' },
  { id: 'jeju', name: '제주' }
];

const businessTypes = [
  { id: 'all', name: '전체 업종' },
  { id: 'cafe', name: '카페' },
  { id: 'restaurant', name: '음식점' },
  { id: 'bakery', name: '베이커리' },
  { id: 'fastfood', name: '패스트푸드' },
  { id: 'bar', name: '주점' }
];

/**
 * StoreFilterBar — 지역/업종 필터 + 뷰모드 전환 (다크 글래스모피즘)
 */
export default function StoreFilterBar({
  selectedRegion,
  onRegionChange,
  selectedType,
  onTypeChange,
  showFavoritesOnly,
  onFavoritesToggle,
  hasActiveFilters,
  onClearFilters,
  viewMode,
  onViewModeChange,
  customerPhone,
}) {
  return (
    <section className="bg-slate-950/50 backdrop-blur-xl border-b border-white/5 sticky top-[101px] z-40">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-10 py-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 mr-2">
              <SlidersHorizontal size={18} className="text-orange-500" />
              <span className="text-xs font-black text-white uppercase tracking-widest">Filters</span>
            </div>

            <div className="relative h-12">
              <select
                value={selectedRegion}
                onChange={(e) => onRegionChange(e.target.value)}
                className="h-full pl-6 pr-12 bg-white/5 border border-white/5 rounded-2xl text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer appearance-none transition-all hover:bg-white/10"
              >
                {regions.map(region => (
                  <option key={region.id} value={region.id} className="bg-slate-900">{region.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative h-12">
              <select
                value={selectedType}
                onChange={(e) => onTypeChange(e.target.value)}
                className="h-full pl-6 pr-12 bg-white/5 border border-white/5 rounded-2xl text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer appearance-none transition-all hover:bg-white/10"
              >
                {businessTypes.map(type => (
                  <option key={type.id} value={type.id} className="bg-slate-900">{type.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            {customerPhone && (
              <button
                onClick={onFavoritesToggle}
                className={`h-12 px-5 text-xs font-black rounded-2xl transition-all flex items-center gap-2 border ${
                  showFavoritesOnly
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Heart size={14} className={showFavoritesOnly ? 'fill-rose-400' : ''} /> 찜한 매장
              </button>
            )}

            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="h-12 px-6 text-xs font-black text-orange-500 hover:bg-orange-500/10 rounded-2xl transition-all flex items-center gap-2 border border-orange-500/20"
              >
                <RefreshCw size={14} className="animate-spin-slow" /> 필터 초기화
              </button>
            )}
          </div>

          <div className="flex items-center gap-5">
            <div className="flex bg-white/5 p-2 rounded-[22px] border border-white/5 shadow-inner">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-[16px] text-[11px] font-black transition-all ${viewMode === 'grid' ? 'bg-white text-slate-950 shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Grid3X3 size={16} /> <span className="hidden sm:block uppercase tracking-[0.2em]">Grid</span>
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-[16px] text-[11px] font-black transition-all ${viewMode === 'list' ? 'bg-white text-slate-950 shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <List size={16} /> <span className="hidden sm:block uppercase tracking-[0.2em]">List</span>
              </button>
              <button
                onClick={() => onViewModeChange('map')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-[16px] text-[11px] font-black transition-all ${viewMode === 'map' ? 'bg-white text-slate-950 shadow-2xl' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <MapIcon size={16} /> <span className="hidden sm:block uppercase tracking-[0.2em]">Map</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
