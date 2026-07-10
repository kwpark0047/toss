import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, Clock, Megaphone } from 'lucide-react';
import NaverShareButton from '../common/NaverShareButton';

const StoreInfoBanner = ({ 
  description, 
  address, 
  phone, 
  announcement, 
  announcementActive, 
  isOpen, 
  todayHours,
  storeName
}) => {
  return (
    <div className="cust-bg-card border-b cust-border">
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
              <p className="tds-caption font-semibold truncate">{announcement}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2 min-w-0">
            {description && (
              <p className="tds-body cust-text-sub line-clamp-2 break-words">
                {description}
              </p>
            )}

            <div className="flex flex-wrap gap-x-3 gap-y-1.5 tds-label cust-text-sub">
              {address && (
                <div className="flex items-center gap-1 min-w-0 max-w-full">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{address}</span>
                </div>
              )}
              {todayHours && !todayHours.closed && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>{todayHours.open} - {todayHours.close}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`px-2.5 py-1 rounded-full tds-small font-bold ${
              isOpen
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-grey-100 dark:bg-white/10 text-grey-500 dark:text-grey-400'
            }`}>
              {isOpen ? '영업 중' : '영업 종료'}
            </span>
            <div className="flex items-center gap-1.5">
              {storeName && (
                <NaverShareButton
                  url={window.location.href}
                  title={`${storeName} - 위마켓에서 맛집을 찾았어요!`}
                  size="sm"
                />
              )}
              {phone && (
                <a href={`tel:${phone}`} className="p-2 bg-grey-50 dark:bg-white/5 rounded-full text-grey-400 dark:text-grey-500 hover:text-primary transition-colors">
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default StoreInfoBanner;
