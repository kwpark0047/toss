import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Icon from '../components/ui/Icon';

// Utility for fetching public menu data
const fetchStoreDisplayData = async (storeId) => {
  if (!storeId || storeId === 'undefined') throw new Error('유효하지 않은 매장 ID입니다.');
  
  // Try fetching public store info and menu. 
  // Assuming a public endpoint exists like `/api/stores/${storeId}/public` or similar.
  // Using `/api/menu/${storeId}` if it is a public endpoint.
  const { data } = await axios.get(`/api/stores/${storeId}/menu?isPublic=true`);
  return data;
};

const StoreDisplay = () => {
  const { storeId } = useParams();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Menu Data
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['storeDisplay', storeId],
    queryFn: () => fetchStoreDisplayData(storeId),
    refetchInterval: 300000, // Refresh every 5 minutes automatically
    retry: 2,
    enabled: !!storeId && storeId !== 'undefined'
  });

  // Validations
  if (!storeId || storeId === 'undefined') {
    return <Navigate to="/admin" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Icon icon="Loader2" size="lg" className="h-12 w-12 animate-spin text-orange-500 mb-4" />
        <h2 className="text-2xl font-bold">메뉴판을 불러오는 중입니다...</h2>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 flex items-center justify-center">
        <div className="max-w-2xl bg-red-950/50 border border-red-900 rounded-lg p-6 flex items-start gap-4 text-red-500">
          <Icon icon="AlertCircle" className="h-8 w-8 shrink-0" />
          <div>
            <h2 className="text-2xl font-semibold mb-2">에러 발생</h2>
            <div className="text-lg opacity-90">
              {error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.'}
              <br />
              <button 
                onClick={() => window.location.reload()}
                className="mt-6 px-6 py-3 bg-red-900/50 hover:bg-red-800/50 rounded-lg transition-colors"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { storeName = '우리 매장', categories = [], items = [] } = data || {};

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-orange-500/30 overflow-hidden flex flex-col">
      
      {/* Header - Digital Signage Style */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-10 shadow-lg shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-4 h-12 bg-orange-500 rounded-full"></div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            {storeName} <span className="text-orange-500 font-light ml-2">MENU</span>
          </h1>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-slate-100 tabular-nums tracking-wider">
            {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </div>
          <div className="text-sm font-medium text-slate-400 mt-1 uppercase tracking-widest">
            {currentTime.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
          </div>
        </div>
      </header>

      {/* Main Content Area - Grid Layout */}
      <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        {categories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <p className="text-2xl font-bold">등록된 메뉴가 없습니다.</p>
            <p className="mt-2">관리자 페이지에서 메뉴를 등록해 주세요.</p>
          </div>
        ) : (
          <div className="max-w-[1920px] mx-auto space-y-16">
            {categories.map((category) => {
              const categoryItems = items.filter(item => item.categoryId === category.id && item.isVisible !== false);
              
              if (categoryItems.length === 0) return null;

              return (
                <section key={category.id} className="mb-12">
                  <div className="flex items-center gap-4 mb-8">
                    <h2 className="text-3xl font-bold text-orange-400 border-b-2 border-orange-500/30 pb-2 inline-block">
                      {category.name}
                    </h2>
                    {category.description && (
                      <span className="text-slate-400 text-lg mt-2">{category.description}</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {categoryItems.map((item) => (
                      <div 
                        key={item.id} 
                        className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:bg-slate-800/80 transition-colors"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-4 mb-3">
                            <h3 className="text-2xl font-bold text-slate-100 break-keep">
                              {item.name}
                            </h3>
                            {item.isBest && (
                              <span className="shrink-0 bg-red-500/10 text-red-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-red-500/20">
                                BEST
                              </span>
                            )}
                            {item.isNew && !item.isBest && (
                              <span className="shrink-0 bg-blue-500/10 text-blue-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-blue-500/20">
                                NEW
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-slate-400 text-base mb-6 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="mt-auto pt-4 border-t border-slate-800 flex items-end justify-between">
                          <div className="text-slate-500 text-sm font-medium">
                            {item.isSoldOut ? '품절' : '판매중'}
                          </div>
                          <div className={`text-3xl font-black tabular-nums ${item.isSoldOut ? 'text-slate-600 line-through' : 'text-white'}`}>
                            {item.price?.toLocaleString()}
                            <span className="text-lg font-medium text-slate-500 ml-1">원</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
      
      {/* Footer Ticker / Notice Area */}
      <footer className="h-12 bg-orange-500 text-white flex items-center px-4 overflow-hidden shrink-0">
        <div className="flex whitespace-nowrap animate-marquee">
          <span className="mx-4 font-semibold">WeMarket 디지털 메뉴보드 솔루션입니다. 카운터에서 주문해 주세요.</span>
          <span className="mx-4 font-semibold">WeMarket 디지털 메뉴보드 솔루션입니다. 카운터에서 주문해 주세요.</span>
          <span className="mx-4 font-semibold">WeMarket 디지털 메뉴보드 솔루션입니다. 카운터에서 주문해 주세요.</span>
        </div>
      </footer>
    </div>
  );
};

export default StoreDisplay;
