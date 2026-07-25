const MenuSkeleton = ({ pageBg }) => (
  <div className="min-h-screen p-5 space-y-8 animate-pulse" style={{ background: pageBg }}>
    {/* Header Skeleton */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gray-200" />
        <div className="space-y-2">
          <div className="w-32 h-6 bg-gray-200 rounded-lg" />
          <div className="w-20 h-4 bg-gray-200 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map(i => <div key={i} className="w-10 h-10 rounded-xl bg-gray-200" />)}
      </div>
    </div>
    {/* Category Chips Skeleton */}
    <div className="flex gap-3 overflow-hidden">
      {[1, 2, 3, 4].map(i => <div key={i} className="min-w-[80px] h-10 bg-gray-200 rounded-2xl" />)}
    </div>
    {/* Product List Skeleton */}
    <div className="space-y-5">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white/60 p-5 rounded-[2rem] flex gap-5 border border-white/40">
          <div className="w-28 h-28 bg-gray-200 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-3 py-2">
            <div className="w-1/2 h-6 bg-gray-200 rounded-lg" />
            <div className="w-full h-12 bg-gray-200/50 rounded-lg" />
            <div className="w-1/4 h-6 bg-gray-200 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default MenuSkeleton;
