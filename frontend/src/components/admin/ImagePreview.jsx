import { useState, useEffect } from 'react';
import { Loader2, ImageOff, X } from 'lucide-react';

export const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function ImagePreview({ src, onRemove }) {
  const [status, setStatus] = useState('loading');
  
  useEffect(() => { setStatus('loading'); }, [src]);

  return (
    <div className="relative w-full max-w-[220px] sm:w-48 mx-auto sm:mx-0">
      <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 to-rose-600 rounded-[28px] blur opacity-20" />
      <div className="relative aspect-square rounded-[20px] overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
        {status !== 'error' && (
          <img
            src={src}
            alt="대표 이미지 미리보기"
            decoding="async"
            onLoad={() => setStatus('loaded')}
            onError={() => setStatus('error')}
            className={`w-full h-full object-cover transition-opacity duration-300 \${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-slate-600 animate-spin" aria-hidden="true" />
            <span className="sr-only">이미지 불러오는 중</span>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <ImageOff className="w-8 h-8 text-slate-600" aria-hidden="true" />
            <p className="text-[11px] font-black text-slate-400">이미지를 불러올 수 없습니다</p>
            <p className="text-[10px] text-slate-600 break-all line-clamp-2">URL 또는 파일을 다시 확인해주세요</p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="대표 이미지 제거"
        className="absolute -top-2 -right-2 w-8 h-8 bg-slate-800 hover:bg-rose-500 text-white rounded-full flex items-center justify-center transition-all border border-white/10 shadow-lg"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
