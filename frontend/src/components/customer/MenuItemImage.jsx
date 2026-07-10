import { useState } from 'react';
import { Star } from 'lucide-react';

const MenuItemImage = ({ src, alt, isMagazine }) => {
  const [failed, setFailed] = useState(false);
  const phCls = isMagazine ? 'w-full h-full' : 'w-28 h-28 rounded-[1.5rem]';
  
  if (!src || failed) {
    return (
      <div className={`${phCls} bg-slate-50 flex items-center justify-center text-slate-300 shrink-0 border border-slate-100`}>
        <Star size={32} />
      </div>
    );
  }
  
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${isMagazine ? 'w-full h-full' : 'w-28 h-28 rounded-[1.5rem] ring-4 ring-white'} object-cover shadow-lg group-hover:scale-105 transition-transform duration-700`}
    />
  );
};

export default MenuItemImage;
