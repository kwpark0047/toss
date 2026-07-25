/**
 * StoreSearchSkeleton — 매장 검색 로딩 중 표시되는 스켈레톤 UI
 */
const StoreSearchSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
      <div key={i} className="bg-white/5 rounded-[3rem] border border-white/5 overflow-hidden h-[420px] animate-pulse">
        <div className="h-48 bg-white/5" />
        <div className="p-8 space-y-4">
          <div className="flex justify-between items-center">
            <div className="w-1/2 h-6 bg-white/5 rounded-lg" />
            <div className="w-12 h-6 bg-white/5 rounded-lg" />
          </div>
          <div className="w-full h-4 bg-white/5 rounded-lg" />
          <div className="w-3/4 h-4 bg-white/5 rounded-lg" />
          <div className="pt-8 flex justify-between items-center">
            <div className="w-20 h-4 bg-white/5 rounded-lg" />
            <div className="w-28 h-12 bg-white/10 rounded-2xl" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default StoreSearchSkeleton;
