import { FC } from 'react';

/**
 * Avatar - TDS Avatar 컴포넌트.
 * - 사용자 프로필 이미지 또는 이니셜 표시
 * - 크기: sm(24px), md(32px), lg(40px)
 * - 상태: 기본/초점/비활성화
 * - 대체 텍스트 지원 (이니셜 표시)
 * - 오토레이아웃 gap만 사용 (임의 margin/padding 금지)
 */
export const Avatar: FC<{
  /** 프로필 이미지 URL (필수 아님, 이니셜 표시를 위해 사용) */
  src?: string;
  /** 대체 텍스트 (이미지 로드 실패 시 표시될 텍스트, 기본값: '') */
  alt?: string;
  /** 크기 (sm | md | lg) */
  size?: 'sm' | 'md' | 'lg';
  /** 사용자 이름 (이미지가 없을 때 표시될 이니셜) */
  name?: string;
  /** 사용자 정의 클래스명 */
  className?: string;
  /** 사용자 정의 스타일 객체 */
  style?: React.CSSProperties;
  /** 테두리 표시 여부 */
  withBorder?: boolean;
  /** 테두리 색상 (브랜드 primary 등) */
  borderColor?: string;
}> = ({
  src,
  alt = '',
  size = 'md',
  name,
  className,
  style,
  withBorder = false,
  borderColor,
}) => {
  const sizeToPx = {
    sm: 24,
    md: 32,
    lg: 40,
  };

  const radiusMap = {
    sm: 'rounded-full',
    md: 'rounded-full',
    lg: 'rounded-full',
  };

  const fontSizeMap = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const fontWeightMap = {
    sm: 'font-medium',
    md: 'font-medium',
    lg: 'font-semibold',
  };

  const dimension = sizeToPx[size as keyof typeof sizeToPx];

  return (
    <div
      className={`relative w-${dimension} h-${dimension} ${radiusMap[size as keyof typeof radiusMap]} flex items-center justify-center ${withBorder ? `border-2 border-${borderColor || 'primary'}` : ''} ${className || ''}`}
      style={{
        ...style,
        fontSize: fontSizeMap[size as keyof typeof fontSizeMap],
        fontWeight: fontWeightMap[size as keyof typeof fontWeightMap],
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-grey-100)',
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={`absolute w-full h-full object-cover rounded-full`}
        />
      ) : (
        <span className="flex-shrink-0">
          {name ? name.split(' ').map((n) => n[0].toUpperCase()).join('') : 'U'}
        </span>
      )}
    </div>
  );
};