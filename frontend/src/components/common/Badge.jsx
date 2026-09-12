/**
 * Badge - TDS Badge 컴포넌트.
 * - 토스트·알림·상품 뱃지 등 다양한 문맥에서 사용
 * - 크기: sm(10px), md(12px), lg(14px)
 * - 타입: new · popular · special · sold-out · etc
 * - 오토레이아웃 gap만 사용 (임의 margin/padding 금지)
 */
export const Badge = ({
  children,
  variant = 'custom',
  className,
  style,
}) => {
  const baseClasses = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';

  const variantClasses = {
    new: 'bg-red-100 text-red-800',
    popular: 'bg-yellow-100 text-yellow-800',
    special: 'bg-purple-100 text-purple-800',
    'sold-out': 'bg-gray-100 text-gray-700',
    custom: 'bg-primary/10 text-primary',
  }[variant];

  return (
    <span
      className={`${baseClasses} ${variantClasses || ''} ${className || ''}`}
      style={style}
    >
      {children}
    </span>
  );
};

/**
 * Avatar - TDS Avatar 컴포넌트.
 * - 사용자 프로필 이미지 또는 이니셜 표시
 * - 크기: sm(24px), md(32px), lg(40px)
 * - 상태: 기본/초점/비활성화
 * - 대체 텍스트 지원 (이니셜 표시)
 */
export const Avatar = ({
  src,
  alt = '',
  size = 'md',
  name,
  className,
  style,
  withBorder = false,
}) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const bgColorMap = {
    sm: 'var(--color-grey-300)',
    md: 'var(--color-grey-400)',
    lg: 'var(--color-grey-300)',
  };

  return (
    <div
      className={`relative flex ${sizeMap[size]} items-center justify-center ${withBorder ? 'border-2 border-white' : ''} ${className || ''}`}
      style={{
        ...style,
        backgroundColor: bgColorMap[size],
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover rounded-md`}
        />
      ) : (
        <span
          className={`flex-shrink-0 text-white ${size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'} font-medium`}
        >
          {name ? name.split(' ').map((n) => n[0]).join('') : 'U'}
        </span>
      )}
    </div>
  );
};