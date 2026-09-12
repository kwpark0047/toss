/**
 * Avatar - TDS Avatar 컴포넌트.
 * - 사용자 프로필 이미지 또는 이니셜 표시
 * - 크기: sm(24px), md(32px), lg(40px)
 * - 상태: 기본/초점/비활성화
 * - 대체 텍스트 지원 (이니셜 표시)
 * - 오토레이아웃 gap만 사용 (임의 margin/padding 금지)
 */
export const Avatar = ({
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

  const dimension = sizeToPx[size];

  return (
    <div
      className={`relative w-${dimension} h-${dimension} ${radiusMap[size]} flex items-center justify-center ${withBorder ? `border-2 border-${borderColor || 'primary'}` : ''} ${className || ''}`}
      style={{
        ...style,
        fontSize: fontSizeMap[size],
        fontWeight: fontWeightMap[size],
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