import { useState } from 'react';
import { X, Image, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export const SAMPLE_IMAGES = {
  '한식': [
    { label: '비빔밥', url: 'https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=600&h=600&fit=crop&auto=format' },
    { label: '찌개류', url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=600&fit=crop&auto=format' },
    { label: '구이/삼겹살', url: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&h=600&fit=crop&auto=format' },
    { label: '볶음밥', url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&h=600&fit=crop&auto=format' },
    { label: '샐러드/나물', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=600&fit=crop&auto=format' },
    { label: '한정식/정식', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=600&fit=crop&auto=format' },
  ],
  '일식': [
    { label: '스시/회', url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&h=600&fit=crop&auto=format' },
    { label: '라멘', url: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&h=600&fit=crop&auto=format' },
    { label: '우동/소바', url: 'https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=600&h=600&fit=crop&auto=format' },
    { label: '돈카츠', url: 'https://images.unsplash.com/photo-1607301405390-d831c242f59b?w=600&h=600&fit=crop&auto=format' },
    { label: '오야코동', url: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600&h=600&fit=crop&auto=format' },
    { label: '규동/덮밥', url: 'https://images.unsplash.com/photo-1617196034183-421b4040d20d?w=600&h=600&fit=crop&auto=format' },
  ],
  '양식': [
    { label: '파스타', url: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=600&fit=crop&auto=format' },
    { label: '피자', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=600&fit=crop&auto=format' },
    { label: '스테이크', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=600&fit=crop&auto=format' },
    { label: '리조또', url: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&h=600&fit=crop&auto=format' },
    { label: '샐러드', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=600&fit=crop&auto=format' },
    { label: '수프', url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=600&fit=crop&auto=format' },
  ],
  '중식': [
    { label: '짜장면', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=600&fit=crop&auto=format' },
    { label: '탕수육', url: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&h=600&fit=crop&auto=format' },
    { label: '볶음밥', url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&h=600&fit=crop&auto=format' },
    { label: '딤섬', url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&h=600&fit=crop&auto=format' },
    { label: '마파두부', url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=600&fit=crop&auto=format' },
    { label: '깐풍기/닭요리', url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=600&fit=crop&auto=format' },
  ],
  '카페/베이커리': [
    { label: '아메리카노', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=600&fit=crop&auto=format' },
    { label: '라떼/카푸치노', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&h=600&fit=crop&auto=format' },
    { label: '케이크', url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&h=600&fit=crop&auto=format' },
    { label: '크루아상', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&h=600&fit=crop&auto=format' },
    { label: '샌드위치', url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&h=600&fit=crop&auto=format' },
    { label: '에이드/스무디', url: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=600&h=600&fit=crop&auto=format' },
  ],
  '치킨/패스트푸드': [
    { label: '후라이드', url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=600&fit=crop&auto=format' },
    { label: '양념치킨', url: 'https://images.unsplash.com/photo-1585325701165-1e05a5ce1e2c?w=600&h=600&fit=crop&auto=format' },
    { label: '햄버거', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=600&fit=crop&auto=format' },
    { label: '감자튀김', url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=600&fit=crop&auto=format' },
    { label: '핫도그', url: 'https://images.unsplash.com/photo-1619740455993-9d622ff67a5e?w=600&h=600&fit=crop&auto=format' },
    { label: '치킨버거', url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=600&h=600&fit=crop&auto=format' },
  ],
  '분식': [
    { label: '떡볶이', url: 'https://images.unsplash.com/photo-1635363638580-c2809d049eee?w=600&h=600&fit=crop&auto=format' },
    { label: '김밥', url: 'https://images.unsplash.com/photo-1617196034223-cd6d5bfc5bc9?w=600&h=600&fit=crop&auto=format' },
    { label: '라면/라볶이', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=600&fit=crop&auto=format' },
    { label: '순대/어묵', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=600&fit=crop&auto=format' },
    { label: '튀김', url: 'https://images.unsplash.com/photo-1565310022184-f23a884f29da?w=600&h=600&fit=crop&auto=format' },
    { label: '핫바/꼬치', url: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=600&h=600&fit=crop&auto=format' },
  ],
  '디저트': [
    { label: '아이스크림', url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&h=600&fit=crop&auto=format' },
    { label: '마카롱', url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600&h=600&fit=crop&auto=format' },
    { label: '케이크/타르트', url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&h=600&fit=crop&auto=format' },
    { label: '와플', url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&h=600&fit=crop&auto=format' },
    { label: '쿠키/브라우니', url: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&h=600&fit=crop&auto=format' },
    { label: '빙수', url: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&h=600&fit=crop&auto=format' },
  ],
};

export function SampleImagePicker({ onSelect, onClose }) {
  const cats = Object.keys(SAMPLE_IMAGES);
  const [cat, setCat] = useState(cats[0]);
  const [imgError, setImgError] = useState({});

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-[40px] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xl font-black text-white">샘플 이미지 선택</h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">업종별 기본 메뉴 이미지 · Unsplash</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-2xl flex items-center justify-center transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 px-8 py-4 overflow-x-auto border-b border-white/5 shrink-0 scrollbar-hide">
          {cats.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all \${
                cat === c ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-500 hover:text-white hover:bg-white/10'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-3 gap-4">
            {SAMPLE_IMAGES[cat].map((img, idx) => (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { onSelect(img.url); onClose(); }}
                className="group relative aspect-square rounded-[20px] overflow-hidden border border-white/10 hover:border-orange-500/50 transition-all shadow-xl"
              >
                {imgError[`\${cat}-\${idx}`] ? (
                  <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center text-slate-600 gap-2">
                    <Image size={28} />
                    <span className="text-[10px] font-bold">{img.label}</span>
                  </div>
                ) : (
                  <img
                    src={img.url}
                    alt={img.label}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={() => setImgError(prev => ({ ...prev, [`\${cat}-\${idx}`]: true }))}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all">
                  <p className="text-white text-xs font-black text-center">{img.label}</p>
                </div>
                <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <Check size={12} className="text-white" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="px-8 py-4 border-t border-white/5 shrink-0">
          <p className="text-[10px] text-slate-600 font-medium text-center">
            이미지 출처: Unsplash · 상업적 무료 사용 가능 · 실제 등록 시 고화질 촬영 이미지 권장
          </p>
        </div>
      </motion.div>
    </div>
  );
}
