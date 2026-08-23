import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import QRCode from 'qrcode';
import { storesAPI } from '../../api/stores';
import { toast } from 'sonner';
import { buildMenuUrl } from '../../utils/site';

const DEFAULT_STYLE = { fg: '#0f172a', bg: '#ffffff', logo: '', size: 640 };

/**
 * QrCustomizer (F6) — 매장 브랜딩 QR 코드 생성기.
 * qrcode(오류정정 H) + 캔버스 중앙 로고 합성으로 색상·로고 커스터마이징.
 * 설정은 매장 theme.qrStyle에 저장해 재사용한다.
 */
export default function QrCustomizer() {
  const { storeId } = useParams();
  const canvasRef = useRef(null);
  const [store, setStore] = useState(null);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const menuUrl = buildMenuUrl(storeId);

  // 초기 로드: 매장 + 저장된 qrStyle
  useEffect(() => {
    (async () => {
      try {
        const res = await storesAPI.getById(storeId);
        const s = res?.data || res;
        setStore(s);
        let theme = s?.theme;
        if (typeof theme === 'string') { try { theme = JSON.parse(theme); } catch { theme = null; } }
        if (theme?.qrStyle) setStyle({ ...DEFAULT_STYLE, ...theme.qrStyle });
      } catch { toast.error('매장 정보를 불러오지 못했습니다.'); }
      finally { setLoading(false); }
    })();
  }, [storeId]);

  // QR 렌더 + 로고 합성
  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await QRCode.toCanvas(canvas, menuUrl, {
        errorCorrectionLevel: 'H', // 로고 가림 대비 최고 정정 레벨
        margin: 2,
        width: style.size,
        color: { dark: style.fg, light: style.bg },
      });
      if (style.logo) {
        await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            const s = canvas.width * 0.2;      // 로고 크기 20%
            const x = (canvas.width - s) / 2;
            const pad = s * 0.12;
            // 로고 뒤 흰 배경(정정영역 보호)
            ctx.fillStyle = style.bg || '#ffffff';
            ctx.fillRect(x - pad, x - pad, s + pad * 2, s + pad * 2);
            ctx.drawImage(img, x, x, s, s);
            resolve();
          };
          img.onerror = resolve; // 로고 로드 실패 시 QR만 유지
          img.src = style.logo;
        });
      }
      // qrcode가 설정한 인라인 크기(style.size px)를 표시용으로 축소.
      // 백킹 스토어 해상도는 유지되어 다운로드는 고해상도 그대로.
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    } catch { /* 렌더 실패 무시 */ }
  }, [menuUrl, style]);

  useEffect(() => { if (!loading) render(); }, [loading, render]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `qr-${store?.name || storeId}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const save = async () => {
    setSaving(true);
    try {
      let theme = store?.theme;
      if (typeof theme === 'string') { try { theme = JSON.parse(theme); } catch { theme = {}; } }
      const merged = { ...(theme || {}), qrStyle: style };
      await storesAPI.update(storeId, { theme: merged });
      setStore((prev) => ({ ...prev, theme: merged }));
      toast.success('QR 스타일이 저장되었습니다.');
    } catch { toast.error('저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  const reset = () => setStyle(DEFAULT_STYLE);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>;
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><QrIcon size={22} className="text-orange-400" /> QR 코드 커스터마이징</h1>
          <p className="text-slate-400 text-sm">{store?.name} · 매장 브랜딩 QR</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 미리보기 */}
        <div className="bg-white/5 border border-white/8 rounded-2xl p-6 flex flex-col items-center justify-center">
          <div className="bg-white rounded-2xl p-4 shadow-2xl w-72 h-72">
            <canvas ref={canvasRef} className="rounded-lg" style={{ width: '100%', height: '100%' }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-3 break-all text-center">{menuUrl}</p>
          <div className="flex gap-2 mt-4">
            <button onClick={download} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-black">
              <Download size={15} /> PNG 다운로드
            </button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-xl text-sm font-black disabled:opacity-40">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} 저장
            </button>
          </div>
        </div>

        {/* 컨트롤 */}
        <div className="bg-white/5 border border-white/8 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">QR 색상 (전경)</label>
            <div className="flex items-center gap-3">
              <input type="color" value={style.fg} onChange={(e) => setStyle((s) => ({ ...s, fg: e.target.value }))}
                className="w-12 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer" aria-label="QR 전경색" />
              <input type="text" value={style.fg} onChange={(e) => setStyle((s) => ({ ...s, fg: e.target.value }))}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">배경 색상</label>
            <div className="flex items-center gap-3">
              <input type="color" value={style.bg} onChange={(e) => setStyle((s) => ({ ...s, bg: e.target.value }))}
                className="w-12 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer" aria-label="QR 배경색" />
              <input type="text" value={style.bg} onChange={(e) => setStyle((s) => ({ ...s, bg: e.target.value }))}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-300 mb-2">중앙 로고 이미지 URL (선택)</label>
            <input type="text" value={style.logo} onChange={(e) => setStyle((s) => ({ ...s, logo: e.target.value }))}
              placeholder="https://.../logo.png"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600" />
            <p className="text-[11px] text-slate-500 mt-1.5">오류정정 레벨 H로 생성되어 중앙 로고(20%)가 있어도 스캔됩니다.</p>
          </div>
          <div className="flex gap-2 pt-2">
            {[['#0f172a', '#ffffff'], ['#f97316', '#ffffff'], ['#1e40af', '#eff6ff'], ['#065f46', '#ecfdf5']].map(([fg, bg]) => (
              <button key={fg} onClick={() => setStyle((s) => ({ ...s, fg, bg }))}
                className="w-9 h-9 rounded-lg border border-white/10" style={{ background: fg }} aria-label={`색상 프리셋 ${fg}`} />
            ))}
            <button onClick={reset} className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-white/5 text-slate-300 rounded-lg text-xs font-bold">
              <RotateCcw size={13} /> 초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
