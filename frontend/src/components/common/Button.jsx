import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button — TDS Button 계층 공용 컴포넌트.
 *
 * variant: primary(채움) · secondary(톤온톤) · neutral(회색) · outline(테두리)
 * size:    sm(h-10) · md(h-12) · lg(h-14)
 * 상태:    disabled/loading(스피너), pressed(active:scale)
 * layout:  center(기본) · between(아이콘+텍스트 / 가격 양끝 배치)
 */
const VARIANTS = {
  primary: 'bg-primary text-white shadow-lg shadow-primary/20 hover:brightness-105',
  secondary: 'bg-primary/10 text-primary hover:bg-primary/15',
  neutral: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  outline: 'border border-slate-200 text-slate-700 bg-white hover:bg-slate-50',
};

const SIZES = {
  sm: 'h-10 text-sm rounded-xl px-4',
  md: 'h-12 text-sm rounded-xl px-4',
  lg: 'h-14 text-base rounded-2xl px-6',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  layout = 'center',
  className = '',
  children,
  ...rest
}) {
  const justify = layout === 'between' ? 'justify-between' : 'justify-center';
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center ${justify} gap-2 font-black tracking-tight transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:active:scale-100 disabled:cursor-not-allowed ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  );
}
