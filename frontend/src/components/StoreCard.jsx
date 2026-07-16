/* eslint-disable react-hooks/static-components */
import { motion } from 'framer-motion';
import { Store, Coffee, Utensils, Cake, Pizza, ShoppingBag, MapPin, Star, BellRing, Heart, Navigation, MessageCircle } from 'lucide-react';
import { bizLabel } from '../utils/businessType';

const TYPE_ICONS = {
  cafe: Coffee,
  restaurant: Utensils,
  bakery: Cake,
  fastfood: Pizza,
  bar: ShoppingBag,
};

function getTypeIcon(type) {
  return TYPE_ICONS[type] || Store;
}

/**
 * 영업시간 기반 현재 영업중/마감 상태 반환
 * @param {string} openTime - "HH:MM" 형식
 * @param {string} closeTime - "HH:MM" 형식
 * @returns {{ isOpen: boolean, label: string, hoursText: string }}
 */
function getStoreOpenStatus(openTime, closeTime) {
  if (!openTime || !closeTime) {
    return { isOpen: false, label: '', hoursText: '' };
  }

  const hoursText = `${openTime} - ${closeTime}`;

  try {
    const now = new Date();
    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    // 자정 넘기는 경우 (예: 22:00 - 02:00)
    if (openMinutes > closeMinutes) {
      const isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
      return { isOpen, label: isOpen ? '영업중' : '마감', hoursText };
    }

    const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    return { isOpen, label: isOpen ? '영업중' : '마감', hoursText };
  } catch {
    return { isOpen: false, label: '', hoursText };
  }
}



/**
 * StoreCard — 매장 카드 컴포넌트 (그리드/리스트 뷰 지원)
 */
export default function StoreCard({
  store,
  viewType = 'grid',
  rating = '5.0',
  reviewCount = 0,
  waitingCount = 0,
  isFavorite = false,
  onToggleFavorite,
  onWaitClick,
}) {
  const TypeIcon = getTypeIcon(store.business_type);
  const openStatus = getStoreOpenStatus(store.open_time, store.close_time);

  const navigate = (path) => { window.location.href = path; };

  // ── 리스트 뷰 ──
  if (viewType === 'list') {
    return (
      <motion.div
        layout
        onClick={() => navigate("/menu?store=" + store.id)}
        className="group relative bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6 flex flex-col sm:flex-row gap-8 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="w-full sm:w-40 h-40 sm:h-auto rounded-[2rem] bg-slate-900 border border-white/5 flex items-center justify-center flex-shrink-0 relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
          <TypeIcon className="w-16 h-16 text-slate-700 group-hover:text-orange-500/50 transition-colors" />
          {waitingCount > 0 && (
            <div className="absolute top-4 left-4 bg-orange-500 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-xl shadow-orange-500/20 animate-pulse">
              대기 {waitingCount}팀
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-between py-2">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-black text-2xl text-white group-hover:text-orange-400 transition-colors truncate">{store.name}</h3>
                  <span className="px-3 py-1 bg-white/5 text-slate-400 text-[10px] font-black rounded-full uppercase tracking-widest">{bizLabel(store.business_type)}</span>
                </div>
                <p className="text-slate-400 font-medium flex items-center gap-2 mb-2 leading-relaxed">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  {store.address || '주소 정보가 없습니다'}
                </p>
                {/* 영업시간 표시 */}
                {openStatus.hoursText && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${openStatus.isOpen ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                      {openStatus.isOpen ? '영업중' : '마감'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">{openStatus.hoursText}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 rounded-2xl border border-amber-500/20">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="font-black text-white text-base">{rating}</span>
                </div>
                <span className="text-xs font-bold text-slate-500">리뷰 {reviewCount}건</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-orange-500" />
              </div>
              <span className="text-sm font-black text-slate-300">매장 상세 정보 및 주문</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onWaitClick?.(store);
                }}
                className="px-6 py-3 bg-white/5 text-white text-xs font-black rounded-2xl hover:bg-white/10 border border-white/10 transition-all active:scale-95"
              >
                대기 등록
              </button>
              <button className="px-8 py-3 bg-gradient-to-r from-orange-500 to-rose-600 text-white text-xs font-black rounded-2xl shadow-xl shadow-orange-500/20 hover:scale-105 transition-all active:scale-95">
                메뉴 확인
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── 그리드 뷰 (기본) ──
  return (
    <motion.div
      layout
      onClick={() => navigate("/menu?store=" + store.id)}
      className="group relative bg-white/5 backdrop-blur-xl rounded-[3rem] border border-white/5 hover:border-white/15 transition-all cursor-pointer flex flex-col h-full overflow-hidden"
    >
      <div className="h-52 bg-slate-900 flex items-center justify-center relative overflow-hidden">
        <TypeIcon className="w-20 h-20 text-slate-800 group-hover:text-orange-500/30 group-hover:scale-110 transition-all duration-700 ease-out" />

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

        <div className="absolute inset-0 p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="px-4 py-1.5 bg-slate-950/80 backdrop-blur-xl border border-white/10 text-[10px] font-black text-orange-500 rounded-xl uppercase tracking-widest">
              {bizLabel(store.business_type)}
            </span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => onToggleFavorite?.(store.id, e)}
              className={`w-10 h-10 backdrop-blur-xl border rounded-2xl flex items-center justify-center shadow-2xl transition-colors ${isFavorite ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'bg-slate-950/80 border-white/10 text-rose-500'}`}
            >
              <Heart size={20} className={isFavorite ? 'fill-rose-400' : ''} />
            </motion.button>
          </div>

          <div className="flex items-center gap-3">
            {waitingCount > 0 && (
              <span className="px-4 py-2 bg-orange-600 text-[10px] font-black text-white rounded-xl shadow-2xl shadow-orange-500/30 flex items-center gap-2 animate-pulse">
                <BellRing size={12} /> 실시간 대기 {waitingCount}팀
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="font-black text-xl text-white group-hover:text-orange-400 transition-colors truncate leading-tight">{store.name}</h3>
          <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex-shrink-0">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="font-black text-white text-xs">{rating}</span>
          </div>
        </div>

        <p className="text-sm text-slate-400 font-medium line-clamp-2 mb-3 leading-relaxed flex-1">
          {store.description || store.address || '매장 정보가 아직 등록되지 않았습니다.'}
        </p>

        {/* 영업시간 표시 */}
        {openStatus.hoursText && (
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${openStatus.isOpen ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
              {openStatus.isOpen ? '영업중' : '마감'}
            </span>
            <span className="text-[11px] font-bold text-slate-500">{openStatus.hoursText}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 text-slate-500">
            <MessageCircle size={16} />
            <span className="text-xs font-black uppercase tracking-widest">리뷰 {reviewCount}건</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onWaitClick?.(store);
            }}
            className="bg-white/5 text-white px-6 py-3 rounded-2xl text-[11px] font-black border border-white/10 hover:bg-orange-600 hover:border-orange-500 transition-all hover:scale-105 active:scale-95"
          >
            대기 신청
          </button>
        </div>
      </div>
    </motion.div>
  );
}
