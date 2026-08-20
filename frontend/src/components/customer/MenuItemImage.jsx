import LazyImage from '../common/LazyImage';

/**
 * MenuItemImage — TDS 이미지 컴포넌트 래퍼
 * LazyImage와 호환되는 인터페이스로 통일
 * @param {string} src 이미지 경로
 * @param {string} alt 이미지 설명
 * @param {boolean} isMagazine 매거진 모드 여부
 * @param {string} className 추가 클래스
  */
const MenuItemImage = ({ src, alt, isMagazine, className = '' }) => {
  return (
    <LazyImage
      src={src}
      alt={alt}
      ratio={isMagazine ? 'aspect-video' : 'aspect-square'}
      className={isMagazine ? 'w-full h-full' : 'w-28 h-28 rounded-[1.5rem]'}
      imgClassName={isMagazine ? 'w-full h-full' : 'rounded-[1.5rem] ring-4 ring-white'}
      placeholderEmoji="🍽️"
    />
  );
};

export default MenuItemImage;