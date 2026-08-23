import { motion } from 'framer-motion';
import { Star, ChevronDown, Sparkles } from 'lucide-react';
import StoreMapLeaflet from './StoreMapLeaflet';
import { bizLabel } from '../utils/businessType';
import Icon from './ui/Icon';

/**
 * StoreMapSection — 지도 뷰 (Leaflet + 오른쪽 매장 리스트 패널)
 */
export default function StoreMapSection({ stores, selectedStore, onStoreSelect, ratings }) {
  return (
    <motion.div
      key="map-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col lg:flex-row"
    >
      <div className="flex-1 relative order-2 lg:order-1 bg-slate-900 rounded-3xl overflow-hidden">
        <StoreMapLeaflet
          stores={stores}
          onSelect={onStoreSelect}
        />
      </div>

      <div className="w-full lg:w-[450px] bg-slate-950 border-l border-white/5 flex flex-col order-1 lg:order-2 overflow-hidden">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Sparkles className="text-orange-500" size={20} />
            <h3 className="text-xl font-black text-white">추천 플레이스</h3>
          </div>
          <span className="text-[10px] font-black text-slate-500 bg-white/5 px-3 py-1.5 rounded-xl uppercase tracking-widest">{stores.length} Stores</span>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {stores.map((store, i) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onStoreSelect(store)}
              whileHover={{ x: -4 }}
              className={`p-6 rounded-[2.5rem] border transition-all cursor-pointer group ${selectedStore?.id === store.id ? 'bg-orange-500/10 border-orange-500/50 shadow-2xl shadow-orange-500/10' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/10'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-black text-white group-hover:text-orange-400 transition-colors truncate max-w-[220px]">{store.name}</h4>
                <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-xl border border-white/5">
                  <Icon icon="Star" />
                  <span className="text-[11px] font-black text-white">{ratings?.[store.id]?.rating || '5.0'}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate mb-4">{store.address}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{bizLabel(store.business_type)}</span>
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 group-hover:text-white transition-colors">
                  상세보기 <ChevronDown size={14} className="-rotate-90" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
