import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tablesAPI, storesAPI } from '../../api';
import {
  ArrowLeft, Plus, Edit, Trash2, QrCode, RefreshCw,
  Download, FileText, Loader2, LayoutGrid, List,
  Users, Sparkles, Share2, Printer, Check, X as XIcon, Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import VisualTableMap from './VisualTableMap';
import { getSocket } from '../../utils/socket';
import { handleApiError } from '../../utils/apiError';

/* ─────────────────────────── 카드 디자인 테마 ─────────────────────────── */
const DESIGNS = [
  {
    id: 'dark',
    label: '다크 프리미엄',
    preview: 'from-slate-900 to-slate-800',
    dot: 'bg-orange-500',
    bg: ['#0c1220', '#1e2f4a'],
    accent: '#f97316',
    qrFg: '0c1220',
    titleColor: '#ffffff',
    storeColor: 'rgba(255,255,255,0.65)',
    capColor: 'rgba(255,255,255,0.38)',
    instBg: 'rgba(255,255,255,0.05)',
    instBorder: 'rgba(255,255,255,0.10)',
    instText: 'rgba(255,255,255,0.88)',
    instSub: 'rgba(255,255,255,0.35)',
    brandText: 'rgba(255,255,255,0.18)',
    divider: 'rgba(249,115,22,0.35)',
    glowColor: 'rgba(249,115,22,0.09)',
  },
  {
    id: 'light',
    label: '화이트 클래식',
    preview: 'from-white to-slate-50',
    dot: 'bg-orange-500',
    bg: ['#ffffff', '#f8fafc'],
    accent: '#f97316',
    qrFg: '0f172a',
    titleColor: '#0f172a',
    storeColor: '#475569',
    capColor: '#94a3b8',
    instBg: '#fff7ed',
    instBorder: '#fed7aa',
    instText: '#9a3412',
    instSub: '#c2410c',
    brandText: '#e2e8f0',
    divider: '#e2e8f0',
    glowColor: 'transparent',
  },
  {
    id: 'brand',
    label: '브랜드 오렌지',
    preview: 'from-orange-500 to-rose-600',
    dot: 'bg-white',
    bg: ['#ea580c', '#be123c'],
    accent: '#ffffff',
    qrFg: '0f172a',
    titleColor: '#ffffff',
    storeColor: 'rgba(255,255,255,0.82)',
    capColor: 'rgba(255,255,255,0.55)',
    instBg: 'rgba(0,0,0,0.14)',
    instBorder: 'rgba(255,255,255,0.22)',
    instText: '#ffffff',
    instSub: 'rgba(255,255,255,0.65)',
    brandText: 'rgba(255,255,255,0.28)',
    divider: 'rgba(255,255,255,0.22)',
    glowColor: 'rgba(0,0,0,0.15)',
  },
];

/* ─────────────────────────── Canvas 유틸 ─────────────────────────── */
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImg(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

async function drawCard(canvas, designId, storeName, tableName, capacity) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const d = DESIGNS.find(x => x.id === designId) || DESIGNS[0];

  /* 배경 */
  const bgGrad = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bgGrad.addColorStop(0, d.bg[0]);
  bgGrad.addColorStop(1, d.bg[1]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  /* 상단 글로우 */
  if (d.glowColor !== 'transparent') {
    const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.55);
    glow.addColorStop(0, d.glowColor);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  /* WeMarket 브랜드 뱃지 */
  const BRAND_Y = Math.round(H * 0.072);
  ctx.font = `900 ${Math.round(H * 0.026)}px Arial, sans-serif`;
  ctx.fillStyle = d.accent;
  ctx.fillText('WeMarket', W / 2, BRAND_Y);

  /* 좌우 점 장식 */
  const dotR = Math.round(H * 0.004);
  [W * 0.3, W * 0.7].forEach(dx => {
    ctx.beginPath();
    ctx.arc(dx, BRAND_Y - Math.round(H * 0.015), dotR, 0, Math.PI * 2);
    ctx.fillStyle = d.accent + '88';
    ctx.fill();
  });

  /* 매장명 */
  const STORE_Y = BRAND_Y + Math.round(H * 0.062);
  ctx.font = `700 ${Math.round(H * 0.038)}px Arial, sans-serif`;
  ctx.fillStyle = d.storeColor;
  ctx.fillText(storeName || '', W / 2, STORE_Y);

  /* 구분선 */
  const DIV_Y = STORE_Y + Math.round(H * 0.036);
  const divGrad = ctx.createLinearGradient(W * 0.08, 0, W * 0.92, 0);
  divGrad.addColorStop(0, 'transparent');
  divGrad.addColorStop(0.5, d.divider);
  divGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.08, DIV_Y);
  ctx.lineTo(W * 0.92, DIV_Y);
  ctx.stroke();

  /* QR 이미지 로드 */
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(canvas._qrData || '')}&bgcolor=ffffff&color=${d.qrFg}&margin=2`;
  let qrImg;
  try { qrImg = await loadImg(qrUrl); } catch { /* fallback: skip */ }

  /* QR 컨테이너 */
  const QR_SIZE = Math.round(W * 0.66);
  const QR_PAD  = Math.round(W * 0.045);
  const QR_CW   = QR_SIZE + QR_PAD * 2;
  const QR_CX   = Math.round((W - QR_CW) / 2);
  const QR_CY   = DIV_Y + Math.round(H * 0.034);
  const QR_R    = Math.round(W * 0.055);

  /* QR 카드 그림자 */
  ctx.save();
  ctx.shadowColor  = designId === 'brand' ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.18)';
  ctx.shadowBlur   = Math.round(W * 0.07);
  ctx.shadowOffsetY = Math.round(H * 0.012);
  ctx.fillStyle = '#ffffff';
  rrect(ctx, QR_CX, QR_CY, QR_CW, QR_CW, QR_R);
  ctx.fill();
  ctx.restore();

  if (qrImg) {
    ctx.drawImage(qrImg, QR_CX + QR_PAD, QR_CY + QR_PAD, QR_SIZE, QR_SIZE);
  }

  /* 테이블명 */
  const TABLE_Y = QR_CY + QR_CW + Math.round(H * 0.072);
  ctx.font = `900 ${Math.round(H * 0.092)}px Arial Black, Arial, sans-serif`;
  ctx.fillStyle = d.titleColor;
  ctx.fillText(tableName || '', W / 2, TABLE_Y);

  /* 인원 뱃지 */
  if (capacity) {
    const CAP_Y = TABLE_Y + Math.round(H * 0.048);
    const capText = `${capacity}인석`;
    ctx.font = `700 ${Math.round(H * 0.03)}px Arial, sans-serif`;
    ctx.fillStyle = d.capColor;
    ctx.fillText(capText, W / 2, CAP_Y);
  }

  /* 스캔 안내 박스 */
  const INST_MX = Math.round(W * 0.07);
  const INST_W  = W - INST_MX * 2;
  const INST_H  = Math.round(H * 0.125);
  const INST_Y  = H - INST_H - Math.round(H * 0.075);
  const INST_R  = Math.round(W * 0.045);

  ctx.fillStyle = d.instBg;
  rrect(ctx, INST_MX, INST_Y, INST_W, INST_H, INST_R);
  ctx.fill();
  ctx.strokeStyle = d.instBorder;
  ctx.lineWidth = 1;
  rrect(ctx, INST_MX, INST_Y, INST_W, INST_H, INST_R);
  ctx.stroke();

  const INST_CY = INST_Y + Math.round(INST_H * 0.42);
  ctx.font = `bold ${Math.round(H * 0.034)}px Arial, sans-serif`;
  ctx.fillStyle = d.instText;
  ctx.fillText('📱 스마트폰으로 스캔하여 주문하세요', W / 2, INST_CY);

  ctx.font = `${Math.round(H * 0.024)}px Arial, sans-serif`;
  ctx.fillStyle = d.instSub;
  ctx.fillText('앱 설치 불필요 · 로그인 없이 즉시 주문', W / 2, INST_CY + Math.round(INST_H * 0.38));

  /* 하단 브랜드 */
  ctx.font = `${Math.round(H * 0.02)}px Arial, sans-serif`;
  ctx.fillStyle = d.brandText;
  ctx.fillText('Powered by WeMarket', W / 2, H - Math.round(H * 0.024));
}

/* ─────────────────────────── TableManager ─────────────────────────── */
const TableManager = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore]       = useState(null);
  const [tables, setTables]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [showQrModal, setShowQrModal]   = useState(null);
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [viewMode, setViewMode] = useState('map');

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    if (socket) {
      socket.on('table-updated', (data) => {
        if (data?.store_id === parseInt(storeId)) fetchData();
      });
    }
    return () => { if (getSocket()) getSocket().off('table-updated'); };
  }, [storeId]);

  const fetchData = async () => {
    try {
      const [storeRes, tablesRes] = await Promise.all([
        storesAPI.getById(storeId),
        tablesAPI.getByStore(storeId),
      ]);
      setStore(storeRes.data);
      setTables(tablesRes.data);
    } catch (e) {
      handleApiError(e, '데이터 로딩 실패');
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 테이블을 삭제하시겠습니까?')) return;
    try { await tablesAPI.delete(id); fetchData(); }
    catch (e) { handleApiError(e, '테이블 삭제 실패'); }
  };

  const handleRegenerateQr = async (id) => {
    if (!window.confirm('QR 코드를 재생성하면 기존 코드는 사용 불가합니다. 계속하시겠습니까?')) return;
    try { await tablesAPI.regenerateQr(id); fetchData(); toast.success('QR 코드가 재생성되었습니다.'); }
    catch (e) { handleApiError(e, 'QR 재생성 실패'); }
  };

  const getQrUrl      = (qrCode) => `${window.location.origin}/menu/${qrCode}`;
  const getQrImageUrl = (qrCode, size = 200) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(getQrUrl(qrCode))}&bgcolor=ffffff&color=0f172a&margin=2`;

  /* 전체 PDF 생성 */
  const generatePDF = async () => {
    if (!tables.length) { toast.warn('등록된 테이블이 없습니다.'); return; }
    setPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const PW = 210, PH = 297;
      const CARD_W_MM = 90, CARD_H_MM = 130;
      const COL_GAP = 10, ROW_GAP = 10;
      const COL1_X = (PW - CARD_W_MM * 2 - COL_GAP) / 2;
      const COL2_X = COL1_X + CARD_W_MM + COL_GAP;
      const ROW1_Y = (PH - CARD_H_MM * 2 - ROW_GAP) / 2;
      const ROW2_Y = ROW1_Y + CARD_H_MM + ROW_GAP;
      const positions = [
        [COL1_X, ROW1_Y], [COL2_X, ROW1_Y],
        [COL1_X, ROW2_Y], [COL2_X, ROW2_Y],
      ];

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const posIdx = i % 4;
        if (i > 0 && posIdx === 0) doc.addPage();

        /* 카드를 고해상도 canvas로 렌더 */
        const CVS_W = 900, CVS_H = 1300;
        const canvas = document.createElement('canvas');
        canvas.width = CVS_W; canvas.height = CVS_H;
        canvas._qrData = getQrUrl(table.qr_code);
        await drawCard(canvas, 'dark', store?.name || '', table.name || table.table_number || `Table ${i + 1}`, table.capacity);
        const imgData = canvas.toDataURL('image/png');

        const [px, py] = positions[posIdx];
        /* 카드 배경 */
        doc.addImage(imgData, 'PNG', px, py, CARD_W_MM, CARD_H_MM);
        /* 절단선 */
        doc.setDrawColor(200, 200, 200);
        doc.setLineDashPattern([1, 2], 0);
        doc.setLineWidth(0.2);
        doc.rect(px, py, CARD_W_MM, CARD_H_MM);
      }

      doc.save(`${store?.name || 'tables'}_QR카드.pdf`);
      toast.success('PDF 파일이 다운로드되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('PDF 생성에 실패했습니다.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-[3px] border-orange-500/20 border-t-orange-500 rounded-full" />
        <p className="text-slate-500 font-bold text-xs tracking-widest">테이블 정보 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 px-3 lg:px-4">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 mb-6 lg:mb-10">
        {/* 타이틀 행 */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 lg:gap-5 min-w-0">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/admin')}
              className="w-10 h-10 lg:w-12 lg:h-12 bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all flex-shrink-0">
              <ArrowLeft size={18} />
            </motion.button>
            <div className="min-w-0">
              <h1 className="text-xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                좌석 관리
                <Sparkles size={16} className="text-orange-500 animate-pulse" />
              </h1>
              <p className="text-slate-500 text-[10px] font-bold mt-0.5 uppercase tracking-widest truncate">{store?.name}</p>
            </div>
          </div>

          {/* 테이블 추가 버튼 (우측 고정) */}
          <button onClick={() => { setEditingTable(null); setShowModal(true); }}
            className="flex-shrink-0 h-10 px-4 lg:px-6 bg-orange-500 text-white rounded-xl lg:rounded-2xl flex items-center gap-2 font-black text-xs tracking-wider shadow-lg shadow-orange-500/25 hover:bg-orange-400 transition-all">
            <Plus size={15} /> 추가
          </button>
        </div>

        {/* 컨트롤 행 */}
        <div className="flex items-center gap-2">
          {/* 뷰 토글 */}
          <div className="bg-white/5 p-1 rounded-xl border border-white/5 flex">
            {[{ id: 'map', icon: LayoutGrid, label: '지도' }, { id: 'list', icon: List, label: '목록' }].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-black text-[10px] tracking-widest transition-all ${
                  viewMode === v.id ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-slate-500 hover:text-slate-300'
                }`}>
                <v.icon size={12} /> {v.label}
              </button>
            ))}
          </div>

          <button onClick={generatePDF} disabled={pdfLoading || !tables.length}
            className="h-9 px-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2 text-slate-400 font-black text-[10px] tracking-widest hover:bg-white/10 hover:text-white transition-all disabled:opacity-30">
            {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            PDF
          </button>

          {/* 테이블 수 뱃지 */}
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[10px] font-black text-slate-500">테이블</span>
            <span className="text-xs font-black text-white">{tables.length}</span>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <AnimatePresence mode="wait">
        {viewMode === 'map' ? (
          <motion.div key="map" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="bg-white/5 backdrop-blur-2xl rounded-[2rem] lg:rounded-[3rem] border border-white/5 p-4 lg:p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/4 to-transparent pointer-events-none" />
            <VisualTableMap storeId={storeId} tables={tables} onUpdate={fetchData} />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-5">
            {tables.length === 0 ? (
              <div className="col-span-full py-40 text-center bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                <Users size={44} className="text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 font-bold text-sm mb-2">등록된 테이블이 없습니다</p>
                <p className="text-slate-600 text-xs">테이블을 추가하면 QR코드가 자동 생성됩니다.</p>
              </div>
            ) : tables.map(table => (
              <motion.div key={table.id} layout
                className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-[1.5rem] lg:rounded-[2rem] p-4 lg:p-7 hover:bg-white/10 transition-all group">
                {/* 상단: 이름 + 상태 */}
                <div className="flex justify-between items-start mb-3 lg:mb-6 gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base lg:text-xl font-black text-white tracking-tight mb-1 truncate">{table.table_number || table.name}</h3>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Users size={10} />
                      <span className="font-bold text-[10px]">{table.capacity}인석</span>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full font-black text-[8px] lg:text-[9px] border ${
                    table.status === 'occupied' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    table.status === 'reserved' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                    table.status === 'dirty'    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {table.status === 'occupied' ? '사용중' : table.status === 'reserved' ? '예약됨' :
                     table.status === 'dirty' ? '청소' : '비어있음'}
                  </span>
                </div>

                {/* QR + 재생성 버튼 */}
                <div className="flex gap-2 mb-3 lg:mb-5">
                  <button onClick={() => setShowQrModal(table)}
                    className="flex-1 h-9 lg:h-11 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center gap-1.5 text-orange-400 font-black text-[9px] lg:text-[10px] hover:bg-orange-500 hover:text-white transition-all active:scale-95">
                    <QrCode size={12} /> QR
                  </button>
                  <button onClick={() => handleRegenerateQr(table.id)}
                    className="w-9 h-9 lg:w-11 lg:h-11 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all active:scale-95"
                    title="QR 재생성">
                    <RefreshCw size={12} />
                  </button>
                </div>

                {/* 편집/삭제 — 모바일 항상 표시, 데스크탑 호버 */}
                <div className="flex justify-end gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                  <button onClick={() => { setEditingTable(table); setShowModal(true); }}
                    className="w-8 h-8 lg:w-9 lg:h-9 bg-white/5 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all active:scale-95">
                    <Edit size={12} />
                  </button>
                  <button onClick={() => handleDelete(table.id)}
                    className="w-8 h-8 lg:w-9 lg:h-9 bg-white/5 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 transition-all active:scale-95">
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <TableModal storeId={storeId} table={editingTable}
            onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} />
        )}
        {showQrModal && (
          <QrModal table={showQrModal} store={store}
            qrUrl={getQrUrl(showQrModal.qr_code)}
            getQrImageUrl={getQrImageUrl}
            onClose={() => setShowQrModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─────────────────────────── QR 카드 모달 ─────────────────────────── */
const QrModal = ({ table, store, qrUrl, getQrImageUrl, onClose }) => {
  const [design, setDesign]         = useState('dark');
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting]     = useState(false);
  const [copied, setCopied]         = useState(false);
  const d = DESIGNS.find(x => x.id === design) || DESIGNS[0];

  const tableName = table.name || table.table_number || '';
  const qrImgUrl  = getQrImageUrl(table.qr_code, 400);

  /* PNG 다운로드 */
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width  = 900;
      canvas.height = 1300;
      canvas._qrData = qrUrl;
      await drawCard(canvas, design, store?.name || '', tableName, table.capacity);
      const link = document.createElement('a');
      link.href     = canvas.toDataURL('image/png');
      link.download = `${tableName}_QR카드_${design}.png`;
      link.click();
      toast.success('QR 카드 이미지가 저장되었습니다.');
    } catch {
      toast.error('이미지 생성에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  /* 브라우저 인쇄 */
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width  = 900;
      canvas.height = 1300;
      canvas._qrData = qrUrl;
      await drawCard(canvas, design, store?.name || '', tableName, table.capacity);
      const imgSrc = canvas.toDataURL('image/png');

      const win = window.open('', '_blank', 'width=500,height=700');
      const doc = win.document;

      /* 스타일 */
      const style = doc.createElement('style');
      style.textContent = [
        '@page{size:105mm 148mm;margin:0}',
        'body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f1f5f9}',
        'img{width:105mm;height:148mm;display:block}',
        '@media print{body{background:none}}',
      ].join('');
      doc.head.appendChild(style);
      doc.title = `${tableName} QR 카드`;

      /* 이미지 (data: URI만 — 외부 URL 아님) */
      const img = doc.createElement('img');
      img.src = imgSrc;
      doc.body.appendChild(img);

      /* 로드 후 자동 인쇄 */
      img.onload = () => setTimeout(() => { win.print(); win.close(); }, 300);
    } catch {
      toast.error('인쇄 준비에 실패했습니다.');
    } finally {
      setPrinting(false);
    }
  };

  /* URL 복사 */
  const handleCopy = () => {
    navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      toast.success('주문 URL이 복사되었습니다.');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.92, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 24 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

        {/* ── 왼쪽: 카드 미리보기 ── */}
        <div className="md:w-[320px] flex-shrink-0 flex flex-col items-center justify-center p-8 border-b md:border-b-0 md:border-r border-white/5"
          style={{ background: `linear-gradient(160deg, ${d.bg[0]} 0%, ${d.bg[1]} 100%)` }}>

          {/* 프리뷰 카드 (HTML 렌더) */}
          <div className="w-full max-w-[230px] rounded-[22px] overflow-hidden shadow-2xl"
            style={{ background: `linear-gradient(160deg, ${d.bg[0]} 0%, ${d.bg[1]} 100%)`, border: '1px solid rgba(255,255,255,0.08)' }}>

            {/* 상단 브랜드 영역 */}
            <div className="px-5 pt-6 pb-3 text-center">
              <p className="text-[10px] font-black tracking-[0.3em]" style={{ color: d.accent }}>WeMarket</p>
              <p className="text-[11px] font-bold mt-1 leading-tight" style={{ color: d.storeColor }}>
                {store?.name || '매장명'}
              </p>
              <div className="mt-2.5 h-px w-full opacity-50"
                style={{ background: `linear-gradient(90deg, transparent, ${d.divider}, transparent)` }} />
            </div>

            {/* QR 영역 */}
            <div className="px-4 py-3">
              <div className="bg-white rounded-2xl p-3 shadow-xl">
                <img src={qrImgUrl} alt="QR" className="w-full rounded-lg" crossOrigin="anonymous" />
              </div>
            </div>

            {/* 테이블명 */}
            <div className="px-4 pb-2 text-center">
              <p className="font-black text-2xl leading-none" style={{ color: d.titleColor }}>{tableName}</p>
              <p className="text-[10px] font-bold mt-1.5" style={{ color: d.capColor }}>{table.capacity}인석</p>
            </div>

            {/* 스캔 안내 */}
            <div className="mx-4 mb-5 mt-2 rounded-xl px-3 py-2.5 text-center"
              style={{ background: d.instBg, border: `1px solid ${d.instBorder}` }}>
              <p className="text-[9.5px] font-bold" style={{ color: d.instText }}>📱 스마트폰으로 스캔하여 주문하세요</p>
              <p className="text-[8px] mt-0.5" style={{ color: d.instSub }}>앱 설치 불필요 · 로그인 없이 즉시 주문</p>
            </div>
          </div>

          {/* 인쇄 정보 */}
          <p className="text-slate-600 text-[10px] font-bold mt-4 text-center tracking-wide">
            A6 (105×148mm) 출력 최적화
          </p>
        </div>

        {/* ── 오른쪽: 컨트롤 패널 ── */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between p-8 pb-4">
            <div>
              <h3 className="text-2xl font-black text-white">{tableName}</h3>
              <p className="text-slate-500 text-xs mt-0.5">QR 카드 생성 및 출력</p>
            </div>
            <button onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center">
              <XIcon size={18} />
            </button>
          </div>

          <div className="px-8 pb-8 space-y-7 flex-1">
            {/* 디자인 선택 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Palette size={14} className="text-orange-400" />
                <p className="text-xs font-black text-slate-400 tracking-widest uppercase">카드 디자인</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {DESIGNS.map(dOpt => (
                  <button key={dOpt.id} onClick={() => setDesign(dOpt.id)}
                    className={`relative h-20 rounded-2xl overflow-hidden border-2 transition-all ${
                      design === dOpt.id ? 'border-orange-500 scale-105 shadow-lg shadow-orange-500/20' : 'border-white/10 hover:border-white/25'
                    }`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${dOpt.preview}`} />
                    {design === dOpt.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                    <span className="absolute bottom-2 inset-x-0 text-center text-[9px] font-black"
                      style={{ color: dOpt.id === 'light' ? '#1e293b' : '#ffffff' }}>
                      {dOpt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 테이블 정보 */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">테이블 정보</p>
              {[
                { label: '테이블명', value: tableName },
                { label: '수용 인원', value: `${table.capacity}인석` },
                { label: '주문 URL', value: qrUrl, truncate: true },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">{row.label}</span>
                  <span className={`text-white text-xs font-bold ${row.truncate ? 'max-w-[180px] truncate' : ''}`}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* 액션 버튼 */}
            <div className="space-y-3">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handlePrint} disabled={printing}
                className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-orange-500/25 transition-all disabled:opacity-60">
                {printing ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
                {printing ? '인쇄 준비 중...' : '인쇄하기 (A6)'}
              </motion.button>

              <div className="grid grid-cols-2 gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleDownload} disabled={downloading}
                  className="py-3.5 bg-white/8 hover:bg-white/12 border border-white/10 text-slate-300 hover:text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-60">
                  {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  {downloading ? '생성 중...' : 'PNG 저장'}
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleCopy}
                  className={`py-3.5 border rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                    copied ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}>
                  {copied ? <Check size={15} /> : <Share2 size={15} />}
                  {copied ? '복사됨!' : 'URL 복사'}
                </motion.button>
              </div>
            </div>

            {/* 출력 팁 */}
            <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-2xl p-4 text-xs text-slate-400 space-y-1.5">
              <p className="text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-2">출력 팁</p>
              <p>• A4 용지에 인쇄 후 A6(105×148mm) 크기로 재단하세요.</p>
              <p>• 코팅 처리 시 장기간 사용이 가능합니다.</p>
              <p>• 아크릴 테이블 스탠드 또는 양면테이프로 부착하세요.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ─────────────────────────── 테이블 추가/수정 모달 ─────────────────────────── */
const TableModal = ({ storeId, table, onClose, onSave }) => {
  const [form, setForm]     = useState({ table_number: table?.table_number || '', capacity: table?.capacity || 4 });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (table) await tablesAPI.update(table.id, form);
      else       await tablesAPI.create({ store_id: parseInt(storeId), ...form });
      onSave();
    } catch (err) {
      handleApiError(err, '저장 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl">
        <h3 className="text-2xl font-black text-white mb-8">
          {table ? '테이블 수정' : '새 테이블 추가'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">테이블 이름</label>
            <input type="text" value={form.table_number}
              onChange={e => setForm({ ...form, table_number: e.target.value })}
              placeholder="예: 테이블 A-01, 창가석 1번"
              required
              className="w-full px-5 py-3.5 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none focus:border-orange-500/40 transition-all text-sm placeholder:text-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">수용 인원</label>
            <input type="number" value={form.capacity}
              onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) })}
              placeholder="인원 수" min={1} max={50}
              className="w-full px-5 py-3.5 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none focus:border-orange-500/40 transition-all text-sm" />
          </div>
          <div className="flex gap-3 mt-8">
            <button type="button" onClick={onClose}
              className="flex-1 py-3.5 bg-white/5 text-slate-400 rounded-2xl font-black text-xs tracking-widest hover:text-white transition-all">
              취소
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3.5 bg-orange-500 text-white rounded-2xl font-black text-xs tracking-widest shadow-lg shadow-orange-500/25 hover:bg-orange-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? '저장 중...' : table ? '수정 완료' : '테이블 생성'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default TableManager;
