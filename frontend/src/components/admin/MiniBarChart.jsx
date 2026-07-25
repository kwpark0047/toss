/**
 * MiniBarChart — 의존성 없는 경량 SVG 바 차트.
 * props: data [{label, value}], color, height, valueFormat
 */
export default function MiniBarChart({ data = [], color = '#f97316', height = 120, valueFormat = (v) => v }) {
  if (!data.length) return <div className="text-xs text-slate-500 py-8 text-center">데이터가 없습니다.</div>;
  const max = Math.max(1, ...data.map(d => d.value || 0));
  const n = data.length;
  const gap = 3;
  const barW = 100 / n;

  return (
    <div>
      <svg viewBox={`0 0 100 ${100}`} preserveAspectRatio="none" style={{ width: '100%', height }} role="img" aria-label="추이 차트">
        {data.map((d, i) => {
          const h = ((d.value || 0) / max) * 92;
          const x = i * barW;
          return (
            <rect key={i} x={x + gap / 2} y={100 - h} width={Math.max(0.5, barW - gap)} height={h}
              rx="0.8" fill={color} opacity={d.value ? 0.9 : 0.15}>
              <title>{`${d.label}: ${valueFormat(d.value || 0)}`}</title>
            </rect>
          );
        })}
      </svg>
      {/* x축 라벨(처음·중간·끝) */}
      <div className="flex justify-between mt-1 text-[9px] text-slate-500 tabular-nums">
        <span>{data[0]?.label}</span>
        {n > 2 && <span>{data[Math.floor(n / 2)]?.label}</span>}
        <span>{data[n - 1]?.label}</span>
      </div>
    </div>
  );
}
