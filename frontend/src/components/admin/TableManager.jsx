import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
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
import { buildMenuUrl, buildQrUrl } from '../../utils/site';
import { handleApiError } from '../../utils/apiError';
import Icon from '../ui/Icon';

/* ─────────────────────────── 카드 디자인 테마 ─────────────────────────── */
const DESIGNS = [
  {
    id: 'dark',
    label: '다크 프리미엄',
    preview: 'from-[#0c1220] to-[#1e2f4a]',
    previewColors: ['#0c1220', '#1e2f4a'],
    dot: 'bg-orange-500',
    bg: ['#0c1220', '#152238', '#0a0f1c'],
    accent: '#f97316',
    accentDim: 'rgba(249,115,22,0.18)',
    accentLine: 'rgba(249,115,22,0.45)',
    qrFg: '0c1220',
    titleColor: '#ffffff',
    titleGrad: ['#ffffff', '#e2e8f0'],
    storeColor: 'rgba(255,255,255,0.60)',
    capColor: 'rgba(255,255,255,0.32)',
    instBg: 'rgba(255,255,255,0.04)',
    instBorder: 'rgba(255,255,255,0.08)',
    instText: 'rgba(255,255,255,0.92)',
    instSub: 'rgba(255,255,255,0.38)',
    brandText: 'rgba(255,255,255,0.14)',
    dividerColor: 'rgba(249,115,22,0.30)',
    glowColor: 'rgba(249,115,22,0.07)',
    glowColor2: 'rgba(59,130,246,0.04)',
    monoBg: 'rgba(249,115,22,0.12)',
    monoBorder: 'rgba(249,115,22,0.40)',
    qrBorderColor: 'rgba(249,115,22,0.60)',
  },
  {
    id: 'light',
    label: '화이트 클래식',
    preview: 'from-white to-slate-100',
    previewColors: ['#ffffff', '#f1f5f9'],
    dot: 'bg-slate-800',
    bg: ['#ffffff', '#f8fafc', '#f1f5f9'],
    accent: '#f97316',
    accentDim: 'rgba(249,115,22,0.10)',
    accentLine: 'rgba(249,115,22,0.60)',
    qrFg: '0f172a',
    titleColor: '#0f172a',
    titleGrad: ['#0f172a', '#1e293b'],
    storeColor: '#475569',
    capColor: '#94a3b8',
    instBg: '#fff7ed',
    instBorder: '#fdba74',
    instText: '#9a3412',
    instSub: '#c2410c',
    brandText: '#cbd5e1',
    dividerColor: '#e2e8f0',
    glowColor: 'transparent',
    glowColor2: 'transparent',
    monoBg: 'rgba(249,115,22,0.08)',
    monoBorder: 'rgba(249,115,22,0.35)',
    qrBorderColor: 'rgba(249,115,22,0.50)',
  },
  {
    id: 'brand',
    label: '브랜드 오렌지',
    preview: 'from-orange-500 to-rose-700',
    previewColors: ['#ea580c', '#9f1239'],
    dot: 'bg-white',
    bg: ['#c2410c', '#9f1239', '#7f1d1d'],
    accent: '#ffffff',
    accentDim: 'rgba(255,255,255,0.15)',
    accentLine: 'rgba(255,255,255,0.50)',
    qrFg: '0f172a',
    titleColor: '#ffffff',
    titleGrad: ['#ffffff', '#fde8d8'],
    storeColor: 'rgba(255,255,255,0.78)',
    capColor: 'rgba(255,255,255,0.52)',
    instBg: 'rgba(0,0,0,0.18)',
    instBorder: 'rgba(255,255,255,0.18)',
    instText: '#ffffff',
    instSub: 'rgba(255,255,255,0.62)',
    brandText: 'rgba(255,255,255,0.24)',
    dividerColor: 'rgba(255,255,255,0.20)',
    glowColor: 'rgba(0,0,0,0.18)',
    glowColor2: 'rgba(255,255,255,0.06)',
    monoBg: 'rgba(255,255,255,0.14)',
    monoBorder: 'rgba(255,255,255,0.45)',
    qrBorderColor: 'rgba(255,255,255,0.60)',
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

/* ── 코너 브라켓 장식 ── */
function drawBrackets(ctx, x, y, w, h, len, thick, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thick;
  ctx.lineCap = 'round';
  const corners = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(cx + dx * (r + len), cy);
    ctx.lineTo(cx + dx * r, cy);
    ctx.arcTo(cx, cy, cx, cy + dy * r, r);
    ctx.lineTo(cx, cy + dy * (r + len));
    ctx.stroke();
  });
  ctx.restore();
}

/* ── 그라디언트 구분선 ── */
function drawDivider(ctx, W, y, d) {
  const grd = ctx.createLinearGradient(W * 0.05, 0, W * 0.95, 0);
  grd.addColorStop(0, 'transparent');
  grd.addColorStop(0.35, d.dividerColor);
  grd.addColorStop(0.65, d.dividerColor);
  grd.addColorStop(1, 'transparent');
  ctx.strokeStyle = grd;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.05, y);
  ctx.lineTo(W * 0.95, y);
  ctx.stroke();

  /* 중앙 다이아몬드 */
  const dS = 5;
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = d.accent;
  ctx.fillRect(-dS / 2, -dS / 2, dS, dS);
  ctx.restore();
}

async function drawCard(canvas, designId, storeName, tableName, capacity) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const d = DESIGNS.find(x => x.id === designId) || DESIGNS[0];

  /* ── 배경 3-stop 그라디언트 ── */
  const bgGrad = ctx.createLinearGradient(0, 0, W * 0.25, H);
  bgGrad.addColorStop(0, d.bg[0]);
  bgGrad.addColorStop(0.55, d.bg[1]);
  bgGrad.addColorStop(1, d.bg[2]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  /* ── 사선 패턴 (질감) ── */
  if (designId !== 'light') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.018)';
    ctx.lineWidth = 1;
    for (let i = -H; i < W + H; i += 28) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    }
    ctx.restore();
  }

  /* ── 상단 방사형 글로우 ── */
  if (d.glowColor !== 'transparent') {
    const g1 = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.9);
    g1.addColorStop(0, d.glowColor);
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  }
  if (d.glowColor2 !== 'transparent') {
    const g2 = ctx.createRadialGradient(W, H, 0, W, H, W * 0.8);
    g2.addColorStop(0, d.glowColor2);
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  /* ── 상단 모노그램 뱃지 ── */
  const TOP_PAD = Math.round(H * 0.05);
  const MONO_R = Math.round(W * 0.045);
  const MONO_CX = W / 2, MONO_CY = TOP_PAD + MONO_R;

  /* 뱃지 원 배경 */
  ctx.beginPath(); ctx.arc(MONO_CX, MONO_CY, MONO_R, 0, Math.PI * 2);
  ctx.fillStyle = d.monoBg; ctx.fill();
  ctx.strokeStyle = d.monoBorder; ctx.lineWidth = 1.5; ctx.stroke();

  /* "W" 모노그램 */
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(MONO_R * 1.2)}px Arial Black, Arial`;
  ctx.fillStyle = d.accent;
  ctx.fillText('W', MONO_CX, MONO_CY + 1);
  ctx.restore();

  /* WeMarket 워드마크 */
  const WM_Y = MONO_CY + MONO_R + Math.round(H * 0.025);
  ctx.font = `800 ${Math.round(H * 0.022)}px Arial, sans-serif`;
  ctx.fillStyle = d.accent;
  ctx.fillText('WeMarket', W / 2, WM_Y);

  /* 좌우 점 장식 */
  const dotR = Math.round(H * 0.0036);
  [-1, 1].forEach(dir => {
    const dx = W / 2 + dir * Math.round(W * 0.20);
    ctx.beginPath(); ctx.arc(dx, WM_Y - Math.round(H * 0.015), dotR, 0, Math.PI * 2);
    ctx.fillStyle = d.accent + 'aa'; ctx.fill();
  });

  /* 매장명 */
  const STORE_Y = WM_Y + Math.round(H * 0.038);
  ctx.font = `600 ${Math.round(H * 0.030)}px Arial, sans-serif`;
  ctx.fillStyle = d.storeColor;
  ctx.fillText(storeName || '', W / 2, STORE_Y);

  /* ── 그라디언트 구분선 + 다이아몬드 ── */
  const DIV_Y = STORE_Y + Math.round(H * 0.028);
  drawDivider(ctx, W, DIV_Y, d);

  /* ── QR 컨테이너 ── */
  const QR_PAD = Math.round(W * 0.035);
  const QR_SIZE = Math.round(W * 0.60);
  const QR_CW = QR_SIZE + QR_PAD * 2;
  const QR_CX = Math.round((W - QR_CW) / 2);
  const QR_CY = DIV_Y + Math.round(H * 0.025);
  const QR_R = Math.round(W * 0.05);

  /* 외부 글로우 */
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = Math.round(W * 0.08);
  ctx.shadowOffsetY = Math.round(H * 0.012);
  ctx.fillStyle = '#ffffff';
  rrect(ctx, QR_CX, QR_CY, QR_CW, QR_CW, QR_R);
  ctx.fill();
  ctx.restore();

  /* 얇은 악센트 테두리 */
  ctx.strokeStyle = d.qrBorderColor;
  ctx.lineWidth = 1.5;
  rrect(ctx, QR_CX, QR_CY, QR_CW, QR_CW, QR_R);
  ctx.stroke();

  /* QR 이미지 로드 */
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(canvas._qrData || '')}&bgcolor=ffffff&color=${d.qrFg}&margin=4`;
  let qrImg;
  try { qrImg = await loadImg(qrImgUrl); } catch { /* fallback */ }
  if (qrImg) ctx.drawImage(qrImg, QR_CX + QR_PAD, QR_CY + QR_PAD, QR_SIZE, QR_SIZE);

  /* 코너 브라켓 장식 */
  drawBrackets(ctx, QR_CX - 6, QR_CY - 6, QR_CW + 12, QR_CW + 12,
    Math.round(W * 0.06), 2.5, Math.round(W * 0.02), d.qrBorderColor);

  /* ── 테이블 섹션 ── */
  const TBL_BASE = QR_CY + QR_CW + Math.round(H * 0.035);

  /* "TABLE" 소문자 레이블 */
  ctx.font = `700 ${Math.round(H * 0.020)}px Arial, sans-serif`;
  ctx.fillStyle = d.capColor;
  ctx.fillText('T  A  B  L  E', W / 2, TBL_BASE);

  /* 오렌지 강조선 */
  const ACCENT_LINE_Y = TBL_BASE + Math.round(H * 0.012);
  ctx.save();
  ctx.strokeStyle = d.accent;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(W / 2 - Math.round(W * 0.08), ACCENT_LINE_Y);
  ctx.lineTo(W / 2 + Math.round(W * 0.08), ACCENT_LINE_Y);
  ctx.stroke();
  ctx.restore();

  /* 테이블명 - 그라디언트 텍스트 */
  const TBL_NAME_Y = ACCENT_LINE_Y + Math.round(H * 0.075);
  const tFS = Math.round(H * 0.08);
  ctx.font = `900 ${tFS}px Arial Black, Arial, sans-serif`;

  const tGrd = ctx.createLinearGradient(W / 2, TBL_NAME_Y - tFS, W / 2, TBL_NAME_Y);
  tGrd.addColorStop(0, d.titleGrad[0]);
  tGrd.addColorStop(1, d.titleGrad[1]);
  ctx.fillStyle = tGrd;
  ctx.fillText(tableName || '', W / 2, TBL_NAME_Y);

  /* 인원 뱃지 - 알약형 */
  if (capacity) {
    const capText = `  ${capacity}인석  `;
    ctx.font = `700 ${Math.round(H * 0.024)}px Arial, sans-serif`;
    const capW = ctx.measureText(capText).width + Math.round(W * 0.035);
    const capH = Math.round(H * 0.038);
    const capX = W / 2 - capW / 2;
    const capY = TBL_NAME_Y + Math.round(H * 0.018);

    ctx.fillStyle = d.accentDim;
    rrect(ctx, capX, capY, capW, capH, capH / 2);
    ctx.fill();
    ctx.strokeStyle = d.accentLine;
    ctx.lineWidth = 1;
    rrect(ctx, capX, capY, capW, capH, capH / 2);
    ctx.stroke();

    ctx.fillStyle = d.accent;
    ctx.textBaseline = 'middle';
    ctx.fillText(`${capacity}인석`, W / 2, capY + capH / 2);
    ctx.textBaseline = 'alphabetic';
  }

  /* ── 스캔 안내 박스 ── */
  const INST_MX = Math.round(W * 0.06);
  const INST_W = W - INST_MX * 2;
  const INST_H = Math.round(H * 0.11);
  const INST_Y = H - INST_H - Math.round(H * 0.06);
  const INST_R = Math.round(W * 0.04);

  ctx.fillStyle = d.instBg;
  rrect(ctx, INST_MX, INST_Y, INST_W, INST_H, INST_R);
  ctx.fill();
  ctx.strokeStyle = d.instBorder;
  ctx.lineWidth = 1;
  rrect(ctx, INST_MX, INST_Y, INST_W, INST_H, INST_R);
  ctx.stroke();

  /* 이모지 아이콘 행 */
  const ICON_Y = INST_Y + Math.round(INST_H * 0.36);
  ctx.font = `${Math.round(H * 0.03)}px Arial`;
  ctx.textBaseline = 'middle';
  ['📱', '→', '🍽️'].forEach((ic, i) => {
    ctx.fillText(ic, INST_MX + INST_W * (i * 0.33 + 0.165), ICON_Y);
  });
  ctx.textBaseline = 'alphabetic';

  /* 메인 안내 문구 */
  const INST_TEXT_Y = ICON_Y + Math.round(INST_H * 0.37);
  ctx.font = `bold ${Math.round(H * 0.028)}px Arial, sans-serif`;
  ctx.fillStyle = d.instText;
  ctx.fillText('QR 스캔하여 바로 주문하세요', W / 2, INST_TEXT_Y);

  ctx.font = `${Math.round(H * 0.021)}px Arial, sans-serif`;
  ctx.fillStyle = d.instSub;
  ctx.fillText('앱 설치 불필요  ·  로그인 없이 즉시 주문', W / 2, INST_TEXT_Y + Math.round(INST_H * 0.29));

  /* ── 하단 브랜드 ── */
  const FOOT_Y = H - Math.round(H * 0.022);
  ctx.font = `${Math.round(H * 0.018)}px Arial, sans-serif`;
  ctx.fillStyle = d.brandText;
  ctx.fillText('Powered by WeMarket', W / 2, FOOT_Y);
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
  const [activeFloor, setActiveFloor]   = useState('5층');
  const [searchQuery, setSearchQuery]   = useState('');

  const fetchData = useCallback(async () => {
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
  }, [storeId, navigate]);

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    if (socket) {
      socket.on('table-updated', (data) => {
        if (data?.store_id === parseInt(storeId)) fetchData();
      });
    }
    return () => { if (getSocket()) getSocket().off('table-updated'); };
  }, [storeId, fetchData]);

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

  /* QR에 담길 URL — 백엔드 없이 메뉴 직접 경로 인코딩
   * Render 콜드스타트 우회: /menu/{storeId}?table={번호} 로 QrResolvePage 완전 제거 */
  const getMenuUrl = (table) => table?.qr_code ? buildQrUrl(table.qr_code) : buildMenuUrl(storeId, table.table_number || table.name || '');

  /* QR 이미지 서비스 URL (margin=4 로 quiet zone 확보) */
  const getQrImageUrl = (menuUrl, size = 200) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(menuUrl)}&bgcolor=ffffff&color=0f172a&margin=4`;

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
        canvas._qrData = getMenuUrl(table);
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

  const getSeatDisplayName = (name) => {
    const cleanName = name || '';
    if (cleanName.toUpperCase().startsWith('V')) {
      return `고정${cleanName}`;
    } else if (cleanName.toUpperCase().startsWith('S')) {
      return `자유${cleanName}`;
    } else {
      return `일반${cleanName}`;
    }
  };

  const getOccupantAndEndDate = (table) => {
    if (table.status === 'occupied') {
      const names = ['임SS', '김SS', '최SS', '박SS', '정SS'];
      return {
        user: names[table.id % names.length],
        date: '2026-07-12'
      };
    } else if (table.status === 'reserved') {
      return {
        user: '정SS',
        date: '2026-07-11'
      };
    } else {
      return {
        user: '없음',
        date: '없음'
      };
    }
  };

  const filteredTablesByFloor = tables.filter(t => {
    const name = t.table_number || t.name || '';
    const isVorS = name.toUpperCase().startsWith('V') || name.toUpperCase().startsWith('S');
    if (activeFloor === '5층') {
      return isVorS || t.id % 2 === 0;
    } else {
      return !isVorS && t.id % 2 !== 0;
    }
  });

  const searchedTables = filteredTablesByFloor.filter(t => {
    const name = t.table_number || t.name || '';
    const dispName = getSeatDisplayName(name);
    return dispName.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
            className="lg:grid lg:grid-cols-12 lg:gap-8 space-y-6 lg:space-y-0">
            
            {/* 왼쪽 패널: 층 선택 탭 + 플로어 플랜 (7/12 컬럼) */}
            <div className="lg:col-span-8 space-y-4">
              {/* 층수 탭 선택기 (첨부 이미지 매칭) */}
              <div className="flex gap-2">
                {['5층', '4층'].map(floor => (
                  <button
                    key={floor}
                    onClick={() => setActiveFloor(floor)}
                    className={`px-6 py-2 rounded-full font-bold text-xs tracking-widest border transition-all ${
                      activeFloor === floor
                        ? 'border-orange-500 text-orange-500 bg-orange-500/5 shadow-md shadow-orange-500/5'
                        : 'border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {floor}
                  </button>
                ))}
              </div>

              {/* 비주얼 테이블 맵 컨테이너 */}
              <div className="bg-white/5 backdrop-blur-2xl rounded-[2rem] lg:rounded-[3rem] border border-white/5 p-4 lg:p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/4 to-transparent pointer-events-none" />
                <VisualTableMap storeId={storeId} tables={filteredTablesByFloor} onUpdate={fetchData} />
              </div>
            </div>

            {/* 오른쪽 패널: "좌석 현황" 사이드 바 (5/12 컬럼) */}
            <div className="lg:col-span-4 bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-white/5 p-6 flex flex-col h-[560px] overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-500/3 to-transparent pointer-events-none" />
              
              <div className="relative z-10 flex flex-col h-full">
                {/* 패널 제목 */}
                <h2 className="text-base font-black text-white tracking-tight mb-4">좌석 현황</h2>

                {/* 검색 바 */}
                <div className="relative mb-5">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="검색"
                    className="w-full h-10 pl-4 pr-10 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* 데이터 그리드/표 헤더 */}
                <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-black text-slate-500 tracking-wider border-b border-white/5 uppercase mb-2">
                  <div className="col-span-4">좌석</div>
                  <div className="col-span-4 text-center">사용자</div>
                  <div className="col-span-4 text-right">종료일자</div>
                </div>

                {/* 스크롤 가능한 필터링된 좌석 리스트 */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                  {searchedTables.length === 0 ? (
                    <div className="py-24 text-center">
                      <p className="text-slate-500 font-bold text-xs">일치하는 좌석이 없습니다.</p>
                    </div>
                  ) : (
                    searchedTables.map(table => {
                      const occ = getOccupantAndEndDate(table);
                      const isOccupied = table.status === 'occupied' || table.status === 'reserved';
                      return (
                        <div
                          key={table.id}
                          className="grid grid-cols-12 items-center px-5 py-3.5 bg-white/5 border border-white/5 rounded-full hover:bg-white/8 transition-all duration-100"
                        >
                          {/* 좌석 이름 */}
                          <div className="col-span-4 text-xs font-black text-white tracking-tight">
                            {getSeatDisplayName(table.table_number || table.name)}
                          </div>
                          
                          {/* 사용자 */}
                          <div className={`col-span-4 text-center text-xs font-black truncate px-1 ${
                            isOccupied ? 'text-slate-300' : 'text-slate-500 opacity-60'
                          }`}>
                            {occ.user}
                          </div>

                          {/* 종료일자 */}
                          <div className={`col-span-4 text-right text-xs font-black tracking-tight ${
                            isOccupied ? 'text-orange-500/80' : 'text-slate-500 opacity-60'
                          }`}>
                            {occ.date}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-5">
            {tables.length === 0 ? (
              <div className="col-span-full py-40 text-center bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                <Icon icon="Users" />
                <p className="text-slate-500 font-bold text-sm mb-2">등록된 테이블이 없습니다</p>
                <p className="text-slate-600 text-xs">테이블을 추가하면 QR코드가 자동 생성됩니다.</p>
              </div>
            ) : tables.map(table => (
              <motion.div key={table.id} layout
                className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-[1.5rem] lg:rounded-[2rem] p-4 lg:p-7 hover:bg-white/10 transition-all group">
                {/* 상단: 이름 + 상태 */}
                <div className="flex justify-between items-start mb-3 lg:mb-6 gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base lg:text-xl font-black text-white tracking-tight mb-1 truncate">{getSeatDisplayName(table.table_number || table.name)}</h3>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Icon icon="Users" />
                      <span className="font-bold text-[10px]">{table.capacity > 0 ? `${table.capacity}인석` : '매장 공통 QR'}</span>
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
            qrUrl={getMenuUrl(showQrModal)}
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
  const [printMode, setPrintMode]   = useState('a6'); // 'a6' or 'a4_4'
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting]     = useState(false);
  const [copied, setCopied]         = useState(false);
  const d = DESIGNS.find(x => x.id === design) || DESIGNS[0];

  const tableName = table.name || table.table_number || '';
  const qrImgUrl  = getQrImageUrl(qrUrl, 400);

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

      const win = window.open('', '_blank', 'width=800,height=900');
      const doc = win.document;

      /* 스타일 */
      const style = doc.createElement('style');
      if (printMode === 'a4_4') {
        style.textContent = [
          '@page{size:A4;margin:0}',
          'body{margin:0;padding:0;width:210mm;height:297mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;align-content:center;justify-items:center;background:#f8fafc}',
          '.card-container{width:105mm;height:148.5mm;display:flex;align-items:center;justify-content:center;position:relative}',
          'img{width:95mm;height:137.2mm;display:block;box-shadow:0 0 0 0.2mm #e2e8f0}',
          '.cut-line-v{position:absolute;top:0;bottom:0;left:105mm;width:0.1mm;border-left:0.1mm dashed #cbd5e1}',
          '.cut-line-h{position:absolute;left:0;right:0;top:148.5mm;height:0.1mm;border-top:0.1mm dashed #cbd5e1}',
          '@media print{body{background:none} img{box-shadow:none}}',
        ].join('');
      } else {
        style.textContent = [
          '@page{size:105mm 148mm;margin:0}',
          'body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f8fafc}',
          'img{width:105mm;height:148mm;display:block}',
          '@media print{body{background:none}}',
        ].join('');
      }
      doc.head.appendChild(style);
      doc.title = `${tableName} QR 카드`;

      if (printMode === 'a4_4') {
        for (let i = 0; i < 4; i++) {
          const container = doc.createElement('div');
          container.className = 'card-container';
          const img = doc.createElement('img');
          img.src = imgSrc;
          container.appendChild(img);
          doc.body.appendChild(container);
        }
        const cv = doc.createElement('div'); cv.className = 'cut-line-v'; doc.body.appendChild(cv);
        const ch = doc.createElement('div'); ch.className = 'cut-line-h'; doc.body.appendChild(ch);
      } else {
        const img = doc.createElement('img');
        img.src = imgSrc;
        doc.body.appendChild(img);
      }

      const imgs = doc.querySelectorAll('img');
      let loaded = 0;
      imgs.forEach(img => {
        img.onload = () => {
          loaded++;
          if (loaded === imgs.length) {
            setTimeout(() => { win.print(); win.close(); }, 500);
          }
        };
      });
    } catch (err) {
      console.error(err);
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
        <div className="md:w-[320px] flex-shrink-0 flex flex-col items-center justify-center p-6 lg:p-8 border-b md:border-b-0 md:border-r border-white/5 relative overflow-hidden"
          style={{ background: `linear-gradient(155deg, ${d.previewColors[0]} 0%, ${d.bg[1] || d.previewColors[1]} 60%, ${d.bg[2] || d.previewColors[1]} 100%)` }}>

          {/* 배경 미묘한 패턴 */}
          {d.id !== 'light' && (
            <div className="absolute inset-0 opacity-[0.025]"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />
          )}

          {/* 프리뷰 카드 */}
          <div className="relative w-full max-w-[210px] rounded-[20px] overflow-hidden shadow-2xl"
            style={{
              background: `linear-gradient(155deg, ${d.previewColors[0]} 0%, ${d.bg[1] || d.previewColors[1]} 100%)`,
              border: `1px solid ${d.id === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: '0 24px 60px rgba(0,0,0,0.50)',
            }}>

            {/* 상단: 모노그램 + 워드마크 */}
            <div className="pt-5 pb-2 px-4 text-center flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
                style={{ background: d.monoBg, border: `1.5px solid ${d.monoBorder}`, color: d.accent }}>W</div>
              <p className="text-[10px] font-black tracking-[0.25em]" style={{ color: d.accent }}>WeMarket</p>
              <p className="text-[10px] font-semibold leading-tight" style={{ color: d.storeColor }}>
                {store?.name || '매장명'}
              </p>
              {/* 구분선 + 다이아몬드 */}
              <div className="relative w-full flex items-center justify-center mt-1">
                <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${d.dividerColor})` }} />
                <div className="w-1.5 h-1.5 rotate-45 mx-1 flex-shrink-0" style={{ background: d.accent }} />
                <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${d.dividerColor}, transparent)` }} />
              </div>
            </div>

            {/* QR 영역 - 코너 브라켓 */}
            <div className="px-3.5 py-2 relative">
              {/* 코너 브라켓 장식 */}
              {[['top-0 left-0', 'border-t-2 border-l-2 rounded-tl-lg'],
                ['top-0 right-0', 'border-t-2 border-r-2 rounded-tr-lg'],
                ['bottom-0 left-0', 'border-b-2 border-l-2 rounded-bl-lg'],
                ['bottom-0 right-0', 'border-b-2 border-r-2 rounded-br-lg']
              ].map(([pos, cls], i) => (
                <div key={i} className={`absolute ${pos} w-5 h-5 ${cls}`}
                  style={{ borderColor: d.qrBorderColor, margin: '6px' }} />
              ))}
              <div className="bg-white rounded-xl p-2.5 shadow-xl"
                style={{ boxShadow: `0 8px 24px rgba(0,0,0,0.30), 0 0 0 1.5px ${d.qrBorderColor}` }}>
                <img src={qrImgUrl} alt="QR" className="w-full rounded-sm" crossOrigin="anonymous" />
              </div>
            </div>

            {/* 테이블 섹션 */}
            <div className="px-4 pt-1 pb-2 text-center">
              <p className="text-[8px] font-bold tracking-[0.2em]" style={{ color: d.capColor }}>T  A  B  L  E</p>
              <div className="my-1 mx-auto rounded-full" style={{ height: 2, width: 40, background: d.accent }} />
              <p className="font-black text-[22px] leading-tight" style={{ color: d.titleColor }}>{tableName}</p>
              {table.capacity > 0 ? (
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{ background: d.accentDim, border: `1px solid ${d.accentLine}`, color: d.accent }}>
                  {table.capacity}인석
                </span>
              ) : (
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{ background: d.accentDim, border: `1px solid ${d.accentLine}`, color: d.accent }}>
                  매장 공통 QR
                </span>
              )}
            </div>

            {/* 스캔 안내 */}
            <div className="mx-3.5 mb-4 mt-2 rounded-xl px-3 py-2 text-center"
              style={{ background: d.instBg, border: `1px solid ${d.instBorder}` }}>
              <div className="flex justify-center gap-2 mb-1 text-[12px]">
                <span>📱</span><span style={{ color: d.capColor }}>→</span><span>🍽️</span>
              </div>
              <p className="text-[9px] font-bold" style={{ color: d.instText }}>QR 스캔하여 바로 주문하세요</p>
              <p className="text-[7.5px] mt-0.5" style={{ color: d.instSub }}>앱 설치 불필요 · 즉시 주문</p>
            </div>

            {/* 하단 */}
            <p className="text-center text-[7px] pb-3" style={{ color: d.brandText }}>Powered by WeMarket</p>
          </div>

          <p className="text-slate-500 text-[9px] font-bold mt-4 text-center tracking-wide">
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
                <Icon icon="Palette" />
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
                { label: '수용 인원', value: table.capacity > 0 ? `${table.capacity}인석` : '테이블 지정 없음 (매장 공통)' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">{row.label}</span>
                  <span className="text-white text-xs font-bold">{row.value}</span>
                </div>
              ))}
              <div>
                <span className="text-slate-500 text-xs block mb-1.5">메뉴판 URL</span>
                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <span className="text-emerald-400 text-[10px] font-mono flex-1 truncate">{qrUrl}</span>
                </div>
                <p className="text-slate-600 text-[10px] mt-1.5 ml-1">
                  위 URL이 QR코드에 담겨있습니다. 테스트 버튼으로 확인하세요.
                </p>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">출력 방식</span>
                  <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
                    {printMode === 'a6' ? '단일 A6' : 'A4 (4분할)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setPrintMode('a6')}
                    className={`py-2.5 rounded-xl text-[11px] font-black transition-all ${
                      printMode === 'a6' ? 'bg-white/10 text-white border border-white/20' : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-300'
                    }`}>
                    A6 (단일)
                  </button>
                  <button onClick={() => setPrintMode('a4_4')}
                    className={`py-2.5 rounded-xl text-[11px] font-black transition-all ${
                      printMode === 'a4_4' ? 'bg-white/10 text-white border border-white/20' : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-300'
                    }`}>
                    A4 (4개)
                  </button>
                </div>
              </div>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handlePrint} disabled={printing}
                className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-orange-500/25 transition-all disabled:opacity-60">
                {printing ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
                {printing ? '인쇄 준비 중...' : printMode === 'a6' ? '인쇄하기 (A6)' : 'A4 인쇄 (4분할)'}
              </motion.button>

              <div className="grid grid-cols-3 gap-2.5">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleDownload} disabled={downloading}
                  className="py-3.5 bg-white/8 hover:bg-white/12 border border-white/10 text-slate-300 hover:text-white rounded-2xl font-black text-[11px] flex items-center justify-center gap-1.5 transition-all disabled:opacity-60">
                  {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  PNG
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleCopy}
                  className={`py-3.5 border rounded-2xl font-black text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                    copied ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}>
                  {copied ? <Check size={14} /> : <Icon icon="Share2" />}
                  {copied ? '복사됨!' : 'URL 복사'}
                </motion.button>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => window.open(qrUrl, '_blank')}
                  className="py-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded-2xl font-black text-[11px] flex items-center justify-center gap-1.5 transition-all">
                  <QrCode size={14} /> 테스트
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
            <input type="text" aria-label="테이블 이름" value={form.table_number}
              onChange={e => setForm({ ...form, table_number: e.target.value })}
              placeholder="예: 테이블 A-01, 창가석 1번"
              required
              className="w-full px-5 py-3.5 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none focus:border-orange-500/40 transition-all text-sm placeholder:text-slate-600" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">수용 인원</label>
            <input type="number" aria-label="수용 인원" value={form.capacity}
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
