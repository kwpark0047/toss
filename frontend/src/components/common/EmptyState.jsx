
/**
 * EmptyState — TDS 빈 상태 패턴 (아이콘 · 타이틀 · 설명 · 선택 액션).
 * @param {React.ReactNode} icon  이모지 문자열 또는 아이콘 노드
 * @param {string} title
 * @param {string} [description]
 * @param {React.ReactNode} [action]  하단 버튼 등
 * @param {'light'|'dark'} [tone]  light(고객, 기본) · dark(관리자 다크 테마)
 * @param {string} [className]
 */
export default function EmptyState({ icon = '🍽️', title, description, action, tone = 'light', className = '' }) {
  const isDark = tone === 'dark';
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      <div className="text-5xl mb-4 select-none opacity-80" aria-hidden="true">{icon}</div>
      <h4 className={`tds-subtitle ${isDark ? 'text-white' : 'cust-text-main'}`}>{title}</h4>
      {description && (
        <p className={`tds-body mt-1.5 max-w-[240px] ${isDark ? 'text-slate-400' : 'cust-text-sub'}`}>{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
