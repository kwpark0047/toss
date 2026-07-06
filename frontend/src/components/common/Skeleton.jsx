import React from 'react';

/**
 * Skeleton — TDS 시머 로딩 플레이스홀더.
 * @param {string} className 크기/모양(w-, h-, rounded- 등)
 */
export default function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />;
}

/**
 * MenuRowSkeleton — 메뉴 ListRow 로딩 자리표시 (썸네일 + 2줄 텍스트 + 담기).
 */
export function MenuRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-4" aria-hidden="true">
      <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-4 w-1/4 mt-1" />
      </div>
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
    </div>
  );
}

/**
 * MenuListSkeleton — 메뉴 리스트 그룹 로딩(여러 행).
 */
export function MenuListSkeleton({ rows = 5 }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => <MenuRowSkeleton key={i} />)}
    </div>
  );
}
