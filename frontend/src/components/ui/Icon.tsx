import { forwardRef } from 'react';
import * as LucideIcons from 'lucide-react';

type LucideIconName = keyof typeof LucideIcons;

interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  icon: LucideIconName;
  size?: 'sm' | 'md' | 'lg';
  stroke?: 'thin' | 'md';
  color?: 'primary' | 'muted' | 'destructive' | 'inverse' | 'inherit';
  className?: string;
}

const sizeMap = {
  sm: 'var(--icon-size-sm)',
  md: 'var(--icon-size-md)',
  lg: 'var(--icon-size-lg)',
};

const strokeMap = {
  thin: 'var(--icon-stroke-thin)',
  md: 'var(--icon-stroke-md)',
};

const colorMap = {
  primary: 'var(--icon-color-primary)',
  muted: 'var(--icon-color-muted)',
  destructive: 'var(--icon-color-destructive)',
  inverse: 'var(--icon-color-inverse)',
  inherit: 'currentColor',
};

/**
 * TDS Icon Wrapper — 단일 진입점으로 모든 아이콘 통일
 * - 크기: sm(16px) / md(20px) / lg(24px)
 * - 스트로크: thin(2) / md(2.5)
 * - 컬러: primary / muted / destructive / inverse / inherit
 * - 기존: <Flame size={10} /> → <Icon icon="Flame" size="sm" color="destructive" />
 * - 기존: <Plus size={18} strokeWidth={3} /> → <Icon icon="Plus" size="md" stroke="md" />
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ icon, size = 'md', stroke = 'md', color = 'inherit', className, ...props }, ref) => {
    const LucideIcon = LucideIcons[icon];

    if (!LucideIcon) {
      console.warn(`[Icon] 알 수 없는 아이콘: "${icon}". lucide-react에서 내보내지 않음.`);
      return null;
    }

    return (
      <LucideIcon
        ref={ref}
        width={sizeMap[size]}
        height={sizeMap[size]}
        strokeWidth={strokeMap[stroke]}
        stroke={colorMap[color]}
        fill="none"
        className={className}
        aria-hidden="true"
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';

export default Icon;