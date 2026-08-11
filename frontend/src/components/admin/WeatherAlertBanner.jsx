import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudRain, ThermometerSnowflake, Sun, CloudDrizzle, CloudFog, X, AlertTriangle } from 'lucide-react';
import { weatherAPI } from '../../api';

const ALERT_ICONS = {
  '폭염특보': { icon: Sun, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  '폭염주의보': { icon: Sun, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  '한파특보': { icon: ThermometerSnowflake, color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  '한파주의보': { icon: ThermometerSnowflake, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  '호우특보': { icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  '호우주의보': { icon: CloudDrizzle, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  '건조주의보': { icon: CloudFog, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

const STATION_LABELS = {
  '108': '서울',
  '112': '인천',
  '133': '대전',
  '159': '부산',
  '184': '제주',
  '105': '강릉',
};

const WeatherAlertBanner = ({ store }) => {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [stationLabel, setStationLabel] = useState(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await weatherAPI.getEnhanced();
        const data = res?.data || res;
        if (Array.isArray(data?.alerts) && data.alerts.length > 0) {
          setAlerts(data.alerts);
          setStationLabel(STATION_LABELS[data.station] || data.station || '현재 위치');
        } else {
          setAlerts([]);
        }
      } catch (_e) {
        setAlerts([]);
      }
    };
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  if (alerts.length === 0 || dismissed) return null;

  const primary = ALERT_ICONS[alerts[0]] || { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  const AlertIcon = primary.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`mx-1 ${primary.bg} ${primary.border} border p-4 rounded-3xl flex items-start justify-between gap-4`}
      >
        <div className="flex items-start gap-3">
          <AlertIcon className={`${primary.color} shrink-0 mt-0.5 animate-pulse`} size={20} />
          <div className="text-left space-y-1">
            <h4 className={`text-sm font-black ${primary.color}`}>
              기상특보 안내{stationLabel ? ` · ${stationLabel}` : ''}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              현재 {stationLabel || '지역'}에 {alerts.join(' · ')} 발효 중입니다. 기상 악화 시 주문량·배달 시간이 달라질 수 있어요.
            </p>
            {store?.name && (
              <p className="text-[10px] text-slate-500 font-bold">
                {store.name} · 동적 가격 및 메뉴 추천에 반영됩니다
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default WeatherAlertBanner;
