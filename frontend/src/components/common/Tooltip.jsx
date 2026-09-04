import { FC } from 'react';

/**
 * Tooltip - TDS Tooltip 컴포넌트.
 * - 요소 위에 마우스 올렸을 때 표시되는 설명 툴팁
 * - 오토레이아웃 gap만 사용 (임의 position 금지)
 * - 포커스 지원 (키보드 접근성)
 */
export const Tooltip: FC<{
  /** 툴팁에 표시할 텍스트 */
  children: React.ReactNode;
  /** 툴팁 트리거가 될 요소 */
  trigger?: 'hover' | 'focus' | 'click';
  /** 툴팁 위치 (top | bottom | left | right) */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** 툴팁 표시 지연 시간 (ms) */
  delay?: number;
  /** 툴팁이 표시된 상태를 제어 */
  visible?: boolean;
  /** 사용자 정의 클래스명 */
  className?: string;
  /** 사용자 정의 스타일 객체 */
  style?: React.CSSProperties;
}> = ({
  children,
  trigger = 'hover',
  placement = 'top',
  delay = 0,
  visible,
  className,
  style,
}) => {
  const placementClasses = {
    top: 'translate-y-[-4px]',
    bottom: 'translate-y-[4px]',
    left: 'translate-x-[-4px]',
    right: 'translate-x-[4px]',
  };

  return (
    <div
      className={`inline-block ${className || ''}`}
      style={style}
    >
      {children}
      <span
        className={`absolute ${placementClasses[placement as keyof typeof placementClasses] || 'translate-y-[-4px]'} bg-slate-900 text-xs text-white px-2 py-1 rounded opacity-0 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'} z-10`}
        role="tooltip"
        aria-live="polite"
      >
        {children}
      </span>
    </div>
  );
};