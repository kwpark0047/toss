import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, MapPin, Phone, Clock, Megaphone } from 'lucide-react';

const StoreInfoBanner = ({ 
  description, 
  address, 
  phone, 
  announcement, 
  announcementActive, 
  isOpen, 
  todayHours 
}) => {
  return (
    <div className="bg-white border-b border-slate-100">
      {/* 공지사항 */}
      <AnimatePresence>
        {announcementActive && announcement && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-primary/5 border-b border-primary/10 overflow-hidden"
          >
            <div className="container mx-auto px-4 py-2 flex items-center gap-2 text-primary">
              <Megaphone className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs font-semibold truncate">{announcement}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {description && (
              <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                {description}
              </p>
            )}
            
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-slate-500">
              {address && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{address}</span>
                </div>
              )}
              {todayHours && !todayHours.closed && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{todayHours.open} - {todayHours.close}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight ${
              isOpen 
                ? 'bg-emerald-100 text-emerald-600' 
                : 'bg-slate-100 text-slate-500'
            }`}>
              {isOpen ? '영업 중' : '영업 종료'}
            </span>
            {phone && (
              <a href={`tel:${phone}`} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-primary transition-colors">
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreInfoBanner;
