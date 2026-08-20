import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageOff, Star } from 'lucide-react';
import Icon from '../ui/Icon';

/**
 * LazyImage — Intersection Observer 기반 지연 로딩 + 스켈레톤 + 블러 업 효과
 * TDS 준수: 아이콘 통일, 시맨틱 토큰, TDS 스택 레이아웃
 * @param {string} src 이미지 경로
 * @param {string} alt 이미지 설명
 * @param {string} className 컨테이너 클래스
 * @param {string} imgClassName 이미지 자체 클래스
 * @param {string} ratio 비율 (aspect-square, aspect-video 등)
 * @param {string} placeholderEmoji 플레이스홀더 이모지
  */
export default function LazyImage({ 
  src, 
  alt = '', 
  className = '', 
  imgClassName = '', 
  ratio = 'aspect-square',
  placeholderEmoji = '🍽️'
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '200px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const containerClassName = `relative overflow-hidden bg-grey-50 border border-grey-100/50 ${ratio} ${className}`;
  
  // TDS 스켈레톤 플레이스홀더
  const SkeletonPlaceholder = ({ placeholderEmoji }) => (
    <motion.div 
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 flex items-center justify-center bg-grey-100 skeleton"
    >
      <span className="text-2xl opacity-20 grayscale">{placeholderEmoji}</span>
    </motion.div>
  );

  // TDS 에러 플레이스홀더
  const ErrorPlaceholder = ({ placeholderEmoji }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-grey-50 text-grey-300">
      <Icon icon="ImageOff" size="md" color="muted" />
      <span className="tds-caption font-bold">이미지 없음</span>
    </div>
  );

  // TDS 이미지 컴포넌트
  const ImageComponent = ({ isLoaded }) => (
    <img
      src={src}
      alt={alt}
      onLoad={() => setIsLoaded(true)}
      onError={() => setError(true)}
      className={`w-full h-full object-cover transition-all duration-700 ${
        isLoaded ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-110 blur-xl'
      } ${imgClassName}`}
    />
  );

  return (
    <div 
      ref={imgRef}
      className={containerClassName}
    >
      <AnimatePresence>
        {!isLoaded && !error && !isInView && <SkeletonPlaceholder placeholderEmoji={placeholderEmoji} />}
      </AnimatePresence>

      {isInView && !error && (
        <>
          {!isLoaded && <SkeletonPlaceholder placeholderEmoji={placeholderEmoji} />}
          <ImageComponent isLoaded={isLoaded} />
        </>
      )}

      {error && <ErrorPlaceholder placeholderEmoji={placeholderEmoji} />}
    </div>
  );
}