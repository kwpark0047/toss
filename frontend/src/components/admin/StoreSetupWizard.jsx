import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, ChefHat, LayoutGrid, QrCode, Check, Plus, Trash2,
  Sparkles, ArrowRight, ArrowLeft, Loader2,
  Clock, Phone, MapPin, PartyPopper, X
} from 'lucide-react';
import { storesAPI, categoriesAPI, productsAPI, tablesAPI, aiAPI } from '../../api';
import { buildMenuUrl, buildQrUrl } from '../../utils/site';

// 공용 컴포넌트 및 유틸 임포트
import WizardTinkerbell, { Wing, speak } from './wizard/WizardTinkerbell';

import BusinessTypePicker, { getBtypeLabel } from './wizard/BusinessTypePicker';
import Step1InlineGuide from './wizard/Step1InlineGuide';

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ────────────────────────────────────────────────────────────────────
//  기본 테이블 레이아웃
// ────────────────────────────────────────────────────────────────────
const DEFAULT_TABLES = [
  { table_number: '기본QR',  x: 24,  y: 24,  capacity: 0, isBase: true  },
  { table_number: '테이블01', x: 180, y: 100, capacity: 4, isBase: false },
  { table_number: '테이블02', x: 340, y: 100, capacity: 4, isBase: false },
  { table_number: '테이블03', x: 500, y: 100, capacity: 4, isBase: false },
];

const STEPS = [
  { id: 1, label: '매장 정보', icon: Store },
  { id: 2, label: '메뉴 등록', icon: ChefHat },
  { id: 3, label: '테이블 배치', icon: LayoutGrid },
  { id: 4, label: 'QR 코드',   icon: QrCode },
];

export default function StoreSetupWizard() {
  const navigate = useNavigate();

  const [step, setStep]               = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [tbMsg, setTbMsg]             = useState('');
  const [tbHappy, setTbHappy]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');
  const voiceEnabledRef = useRef(true);
  
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  const [createdStore,    setCreatedStore]    = useState(null);
  const [createdCategory, setCreatedCategory] = useState(null);
  const [_createdMenus,    setCreatedMenus]    = useState([]);
  const [layoutTables,    setLayoutTables]    = useState([]);

  // Step 1 form
  const [storeForm, setStoreForm] = useState({
    name: '', business_type: 'cafe', description: '', phone: '',
    address: '', open_time: '09:00', close_time: '22:00',
  });
  const [customBtype, setCustomBtype] = useState(''); // 직접 입력 업종
  const [step1Focus, setStep1Focus]   = useState(null); // 현재 포커스된 필드

  // Step 2 menu
  const [menuItems, setMenuItems]     = useState([{ name: '', price: '', description: '' }]);
  const [aiLoadingIdx, setAiLoadingIdx] = useState(null);

  // Step 3 새 테이블 추가
  const [addingTable, setAddingTable]     = useState(false);
  const [newTableName, setNewTableName]   = useState('');
  const [newTableCap, setNewTableCap]     = useState(4);
  const canvasRef = useRef(null);

  // ── 팅커벨 대사
  const sayWithDelay = useCallback((msg, delay = 0, happy = false) => {
    setTimeout(() => { setTbMsg(msg); setTbHappy(happy); }, delay);
  }, []);

  useEffect(() => {
    setErrorMsg('');
    const scripts = {
      0: [
        '안녕하세요, 사장님! 저는 AI 도우미 팅커벨이에요! ✨ 함께 멋진 매장을 만들어볼까요?',
        '어서 오세요! 4단계만 따라오시면 위마켓 매장이 뚝딱 완성돼요! 지금 시작해볼까요?',
        '반갑습니다, 사장님! 오늘부터 스마트한 QR 주문 매장 운영이 시작돼요!',
      ],
      1: [
        '먼저 매장 이름과 업종을 입력해주세요! 정보는 나중에 언제든지 수정할 수 있어요.',
        '매장 이름, 업종, 영업 시간을 알려주세요! 2분이면 충분해요.',
        '① 매장 이름부터 시작해볼까요? 고객들에게 보여질 이름이에요!',
      ],
      2: [
        '이번엔 메뉴를 등록해볼까요? 메뉴 이름 입력 후 AI 버튼을 눌러보세요!',
        '메뉴 이름만 입력하면 AI가 설명과 가격까지 자동으로 완성해줘요!',
        '대표 메뉴부터 입력해보세요! AI가 금방 도와드릴게요. 여러 개 추가도 가능해요!',
      ],
      3: [
        '기본 테이블이 자동으로 배치됐어요! 드래그해서 위치를 바꾸거나 테이블을 추가해보세요.',
        '매장 레이아웃에 맞게 테이블을 배치해주세요. 테이블 번호가 QR 주문에 사용돼요!',
        '테이블을 원하는 대로 자유롭게 배치해보세요! 나중에도 수정할 수 있어요.',
      ],
      4: [
        'QR 코드가 준비됐어요! 인쇄해서 각 테이블에 붙여주세요. 손님들이 바로 주문할 수 있어요! 🎉',
        '드디어 마지막 단계예요! QR 코드를 인쇄해서 테이블에 붙여두면 바로 운영 시작!',
        '완성이 눈앞이에요! QR 코드를 출력하면 오늘부터 스마트 매장이 돼요!',
      ],
    };
    if (step === 1) setStep1Focus(null);
    const candidates = scripts[step];
    if (!candidates) return;
    const msg = pickRandom(candidates);
    sayWithDelay(msg, 300, step === 4);
    
    if (step <= 1) setTimeout(() => speak(msg, voiceEnabledRef.current), 500);
    
    if (step === 4) {
      const extras = [
        { msg: '사장님 정말 대단해요! 단 몇 분 만에 완성하셨어요!', delay: 3500, happy: true },
        { msg: 'QR 인쇄 후 테이블에 붙이면 바로 주문 받을 수 있어요!', delay: 6500, happy: false },
      ];
      extras.forEach(({ msg: m, delay: d, happy: h }) => sayWithDelay(m, d, h));
    }
   
  }, [step, sayWithDelay]);

  // ── Step 1: 매장 저장 + 기본 테이블 자동 생성
  const handleSaveStore = async () => {
    if (!storeForm.name.trim()) return;
    setErrorMsg('');
    setSaving(true);
    try {
      const apiData = {
        ...storeForm,
        business_type: storeForm.business_type === '__custom__'
          ? (customBtype.trim() || 'etc')
          : storeForm.business_type,
      };
      const res = await storesAPI.create(apiData);
      const store = res?.data || res;

      if (store?.linkRequested) {
        sayWithDelay(
          `"${store.matchedStore?.name || storeForm.name}"은(는) 이미 등록된 매장이에요! 🔗 관리자 승인 후 바로 관리하실 수 있어요. 연동 요청을 보냈습니다 ✅`,
          100, true
        );
        setTimeout(() => navigate('/admin', { replace: true }), 4000);
        return;
      }

      setCreatedStore(store);

      const catRes = await categoriesAPI.create({ store_id: store.id, name: '기본 메뉴' });
      setCreatedCategory(catRes?.data || catRes);

      sayWithDelay(pickRandom([
        '매장 정보 저장 완료! 기본 테이블도 자동으로 만들고 있어요...',
        `"${storeForm.name}" 매장이 생성됐어요! 테이블도 자동 배치 중이에요!`,
      ]), 100, true);
      const created = await Promise.all(
        DEFAULT_TABLES.map(t =>
          tablesAPI.create({ store_id: store.id, table_number: t.table_number, capacity: t.capacity, x: t.x, y: t.y })
        )
      );
      const tables = created.map((r, i) => {
        const t = r?.data || r;
        return { ...t, x: t.x ?? DEFAULT_TABLES[i].x, y: t.y ?? DEFAULT_TABLES[i].y };
      });
      setLayoutTables(tables);

      sayWithDelay(pickRandom([
        '완벽해요! 이제 메뉴를 등록해볼까요? 😊',
        '매장 준비 완료! 다음은 손님들이 볼 메뉴를 등록해볼게요!',
        '훌륭해요! 메뉴만 등록하면 반 이상 완성이에요!',
      ]), 800, true);
      setTimeout(() => setStep(2), 1600);
    } catch (e) {
      setErrorMsg('앗, 저장 중 오류가 발생했어요. 다시 시도해주세요!');
      sayWithDelay('앗, 저장 중 오류가 발생했어요. 다시 시도해주세요!', 100);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 2: AI 메뉴 자동완성
  const handleAISuggest = async (idx) => {
    const name = menuItems[idx]?.name?.trim();
    if (!name) {
      sayWithDelay(pickRandom([
        '메뉴 이름을 먼저 입력해주세요!',
        '메뉴 이름 칸에 이름을 적어야 AI가 도울 수 있어요!',
      ]), 0);
      return;
    }
    setAiLoadingIdx(idx);
    sayWithDelay(pickRandom([
      `"${name}" 분석 중이에요! AI가 최적의 정보를 찾고 있어요 ✨`,
      '잠깐만요! AI가 메뉴 정보를 분석 중이에요!',
      `AI가 "${name}"에 딱 맞는 설명과 가격을 찾고 있어요!`,
    ]), 0);
    try {
      const btype = getBtypeLabel(storeForm.business_type, customBtype);
      const res = await aiAPI.proposeMenuFull({ name, categoryName: btype });
      const p = res?.proposal;
      if (p) {
        const newItems = [...menuItems];
        newItems[idx] = { ...newItems[idx], description: p.description || '', price: p.price ? String(p.price) : newItems[idx].price };
        setMenuItems(newItems);
        sayWithDelay(pickRandom([
          `"${name}" 완성! 가격이나 설명을 수정해도 돼요!`,
          `AI가 "${name}" 정보를 완성했어요! 확인하고 필요하면 수정해주세요.`,
          `"${name}" 메뉴 자동완성 성공! 다른 메뉴도 추가해볼까요?`,
        ]), 100, true);
      } else {
        sayWithDelay(pickRandom([
          'AI 추천을 받지 못했어요. 직접 설명과 가격을 입력해주세요!',
          '이 메뉴는 AI가 잘 모르는 것 같아요. 사장님이 직접 입력해주세요!',
        ]), 0);
      }
    } catch {
      sayWithDelay(pickRandom([
        'AI 서비스에 일시적인 문제가 있어요. 직접 입력해주세요!',
        'AI가 잠깐 쉬고 있어요. 직접 입력하거나 잠시 후 다시 시도해주세요!',
      ]), 0);
    } finally {
      setAiLoadingIdx(null);
    }
  };

  // ── Step 2: 메뉴 저장
  const handleSaveMenus = async () => {
    const valid = menuItems.filter(m => m.name.trim() && m.price);
    if (valid.length === 0) {
      sayWithDelay(pickRandom([
        '메뉴를 최소 한 개 이상 입력해주세요!',
        '메뉴 이름과 가격을 하나 이상 입력해야 저장할 수 있어요!',
      ]), 0);
      return;
    }
    setSaving(true);
    sayWithDelay(pickRandom([
      `${valid.length}개 메뉴를 저장하고 있어요! 잠깐만요...`,
      '맛있는 메뉴들을 등록하고 있어요!',
    ]), 0);
    try {
      const products = valid.map(m => ({
        name: m.name.trim(), price: parseInt(m.price, 10) || 0,
        description: m.description?.trim() || '', category_id: createdCategory?.id || null, is_active: true,
      }));
      const res = await productsAPI.bulkCreate({ store_id: createdStore.id, products });
      setCreatedMenus(res?.data || res || []);
      sayWithDelay(pickRandom([
        `${valid.length}개 메뉴 등록 완료! 이제 테이블 배치를 확인해볼까요? 🍽️`,
        '메뉴 저장 성공! 손님들이 정말 좋아하실 것 같아요! 다음은 테이블 배치예요.',
        '맛있겠다! 메뉴 등록 완료! 테이블 배치로 넘어가볼게요!',
      ]), 100, true);
      setTimeout(() => setStep(3), 900);
    } catch (e) {
      sayWithDelay(pickRandom([
        '저장 중 오류가 발생했어요. 다시 시도해주세요!',
        '앗, 잠깐 문제가 생겼어요! 잠시 후 다시 눌러주세요.',
      ]), 0);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 3: 드래그로 위치 변경
  const handleMoveTable = useCallback((id, x, y) => {
    setLayoutTables(prev => prev.map(t => t.id === id ? { ...t, x, y } : t));
  }, []);

  // ── Step 3: 테이블 삭제
  const handleDeleteTable = async (id) => {
    try {
      const target = layoutTables.find(t => t.id === id);
      await tablesAPI.delete(id);
      setLayoutTables(prev => prev.filter(t => t.id !== id));
      sayWithDelay(pickRandom([
        `${target?.table_number || '테이블'} 삭제했어요! 필요하면 다시 추가할 수 있어요.`,
        `삭제 완료! 테이블 배치를 원하는 대로 조정해보세요.`,
      ]), 0);
    } catch (e) {
      console.error('테이블 삭제 실패:', e);
    }
  };

  // ── Step 3: 테이블 추가
  const handleAddTable = async () => {
    if (!newTableName.trim()) return;
    setSaving(true);
    try {
      const existX = layoutTables.map(t => t.x);
      const safeX = Math.max(...existX, 0) + 130 + 20; // TableLayoutCard.CARD_W
      const res = await tablesAPI.create({
        store_id: createdStore.id, table_number: newTableName.trim(),
        capacity: newTableCap, x: Math.min(safeX, 500), y: 180,
      });
      const t = res?.data || res;
      setLayoutTables(prev => [...prev, { ...t, x: t.x ?? Math.min(safeX, 500), y: t.y ?? 180 }]);
      setNewTableName(''); setNewTableCap(4); setAddingTable(false);
      sayWithDelay(pickRandom([
        `${newTableName} 테이블이 추가됐어요! 드래그해서 위치를 잡아보세요.`,
        `${newTableName} 완성! 테이블을 원하는 위치로 옮겨볼까요?`,
        `${newTableName} 추가 완료! 매장이 점점 완성되어 가요!`,
      ]), 0, true);
    } catch (e) {
      console.error('테이블 추가 실패:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 3: 배치 저장
  const handleSaveLayout = async () => {
    setSaving(true);
    sayWithDelay(pickRandom([
      '테이블 배치를 저장하고 있어요! 잠깐만요...',
      `${layoutTables.length}개 테이블 배치를 저장 중이에요!`,
    ]), 0);
    try {
      await Promise.all(layoutTables.map(t => tablesAPI.update(t.id, { x: t.x, y: t.y })));
      sayWithDelay(pickRandom([
        '테이블 배치 저장 완료! 이제 QR 코드만 출력하면 끝이에요! 🎉',
        `${layoutTables.length}개 테이블 배치 완료! 드디어 마지막 단계예요!`,
        '완벽한 레이아웃이에요! QR 코드를 출력하러 가볼까요?',
      ]), 100, true);
      setTimeout(() => setStep(4), 900);
    } catch (e) {
      sayWithDelay(pickRandom([
        '저장 중 오류가 발생했어요. 다시 시도해주세요!',
        '앗, 잠깐 문제가 생겼어요! 다시 한 번 시도해볼까요?',
      ]), 0);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── QR URL
  const getMenuUrl = (table) => table?.qr_code ? buildQrUrl(table.qr_code) : buildMenuUrl(createdStore?.id, table.table_number || '');
  const getQrImgUrl = (table) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getMenuUrl(table))}&bgcolor=ffffff&color=0f172a&margin=6`;

  // ── 완료
  const handleFinish = () => {
    sessionStorage.setItem('wm_setup_skipped', '1');
    const celebrations = [
      { msg: '🎉 완성! 사장님 정말 대단해요! 이제 스마트 매장 운영을 시작해볼까요?', delay: 0, happy: true },
      { msg: '팅커벨이 항상 응원할게요! 주문이 쏟아지기 시작할 거예요!', delay: 2500, happy: true },
    ];
    celebrations.forEach(({ msg, delay, happy }) => sayWithDelay(msg, delay, happy));
    const dest = createdStore?.id ? `/admin/stores/${createdStore.id}/orders` : '/admin';
    setTimeout(() => navigate(dest), 2000);
  };

  const addMenuItem    = () => setMenuItems(p => [...p, { name: '', price: '', description: '' }]);
  const removeMenuItem = (i) => setMenuItems(p => p.filter((_, idx) => idx !== i));
  const updateMenuItem = (i, f, v) => setMenuItems(p => p.map((m, idx) => idx === i ? { ...m, [f]: v } : m));

  const storeName = createdStore?.name || '위마켓 매장';
  const initial   = storeName.trim()[0] || 'W';
  const phone     = (createdStore?.phone || storeForm?.phone || '').trim();

  // ── 인쇄 카드 공용 렌더
  const renderPrintCard = (table) => {
    const isBase = table.table_number === '기본QR';
    return (
      <div key={table.id} style={{
        width: '105mm', height: '148.5mm', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        backgroundColor: '#ffffff', border: '0.4mm solid #e2e8f0',
        pageBreakInside: 'avoid', breakInside: 'avoid',
        overflow: 'hidden', position: 'relative',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ width: '100%', height: '3.5mm', flexShrink: 0,
          background: 'linear-gradient(90deg,#f59e0b,#ea580c)' }} />

        <div style={{
          padding: '3.5mm 5mm 3mm', display: 'flex', flexDirection: 'column',
          alignItems: 'center', flex: 1, width: '100%', boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5mm', marginBottom: '2mm' }}>
            <div style={{
              width: '12mm', height: '12mm', borderRadius: '50%',
              background: 'linear-gradient(135deg,#f59e0b,#ea580c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '6mm', fontWeight: 900, lineHeight: 1,
            }}>{initial}</div>
            <p style={{ margin: 0, fontSize: '4mm', fontWeight: 900, color: '#0f172a',
              textAlign: 'center', lineHeight: 1.2, wordBreak: 'keep-all' }}>
              {storeName}
            </p>
          </div>

          <div style={{ width: '100%', height: '0.3mm', background: '#e2e8f0', margin: '1.5mm 0' }} />

          <img
            src={getQrImgUrl(table)}
            alt={`QR ${table.table_number}`}
            style={{ width: '58mm', height: '58mm', display: 'block', margin: '1.5mm 0' }}
          />

          <div style={{ width: '100%', height: '0.3mm', background: '#e2e8f0', margin: '1.5mm 0' }} />

          {isBase && (
            <span style={{
              display: 'inline-block', background: '#fef3c7', color: '#b45309',
              fontSize: '2.8mm', fontWeight: 700, padding: '0.5mm 2.5mm',
              borderRadius: '1.5mm', marginBottom: '1mm',
            }}>매장 공통</span>
          )}

          <p style={{ margin: '0 0 1.5mm', fontSize: '6.5mm', fontWeight: 900,
            color: '#0f172a', textAlign: 'center', lineHeight: 1.1 }}>
            {isBase ? '테이블 없이 주문' : table.table_number}
          </p>

          {phone && (
            <p style={{ margin: '0 0 1.5mm', fontSize: '3mm', color: '#475569',
              fontWeight: 600, textAlign: 'center' }}>
              ☎ {phone}
            </p>
          )}

          <p style={{ margin: '1.5mm 0 0', fontSize: '3mm', color: '#64748b',
            textAlign: 'center', lineHeight: 1.6, wordBreak: 'keep-all' }}>
            📱 QR코드를 스캔하면<br />메뉴를 확인하고 주문하실 수 있습니다
          </p>

          <p style={{ marginTop: 'auto', paddingTop: '2mm', fontSize: '2.2mm',
            color: '#cbd5e1', textAlign: 'center' }}>
            Powered by 위마켓
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-start px-4 py-8">
      <style>{`
        #qr-print-area { display: none; }

        @media print {
          @page { size: A4 portrait; margin: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden !important; }
          #qr-print-area { display: grid !important; visibility: visible !important; }
          #qr-print-area * { visibility: visible !important; }
          #qr-print-area {
            position: fixed; top: 0; left: 0;
            width: 210mm;
            grid-template-columns: 105mm 105mm;
            grid-auto-rows: 148.5mm;
            gap: 0;
            background: white;
          }
        }
      `}</style>

      {/* 상단 */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="text-white font-black text-sm">위마켓 매장 설정</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="welcome" initial={{ opacity:0, scale:0.92 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.92 }}
            className="w-full max-w-2xl">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-10 text-center">
              <motion.div animate={{ y:[-6,6,-6] }} transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }} className="flex justify-center mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-orange-500/40">
                  <svg viewBox="0 0 24 24" fill="white" width="44" height="44">
                    <path d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
                  </svg>
                </div>
              </motion.div>
              <h1 className="text-3xl font-black text-white mb-2">안녕하세요, 사장님! ✨</h1>
              <p className="text-slate-400 text-base mb-2">저는 AI 도우미 <span className="text-amber-400 font-black">팅커벨</span>이에요!</p>
              <p className="text-slate-400 text-sm mb-8">지금부터 <strong className="text-white">4단계</strong>로 매장 설정을 도와드릴게요.<br />어렵지 않으니 따라오세요! 😊</p>
              <div className="grid grid-cols-4 gap-3 mb-8">
                {STEPS.map(s => { const Icon = s.icon; return (
                  <div key={s.id} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                      <Icon size={16} className="text-amber-400" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">{s.label}</span>
                  </div>
                );})}
              </div>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={() => setStep(1)}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-base shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2">
                지금 시작하기 <ArrowRight size={18} />
              </motion.button>
              <div className="flex items-center justify-between mt-4">
                <button onClick={() => { sessionStorage.setItem('wm_setup_skipped','1'); navigate('/admin'); }}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  건너뛰고 대시보드로 가기
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 스텝 공통 래퍼 ── */}
        {step >= 1 && step <= 4 && (
          <motion.div key="steps" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="w-full max-w-2xl space-y-6">

            {/* 진행 바 */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {STEPS.map((s, i) => { const Icon = s.icon; const done = step > s.id; const active = step === s.id; return (
                <div key={s.id} className="flex-1 flex items-center gap-1.5 sm:gap-2">
                  <div className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition-all flex-shrink-0 ${done ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : active ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'bg-white/5 text-slate-600 border border-white/10'}`}>
                    {done ? <Check size={11} /> : <Icon size={11} />}
                    <span className={active ? 'inline' : 'hidden sm:inline'}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full ${done ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
                </div>
              );})}
            </div>

            <AnimatePresence mode="wait">

              {/* ── STEP 1: 매장 정보 ── */}
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7">
                  <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2"><Store size={20} className="text-amber-400" /> 매장 정보 입력</h2>

                  {/* 팅커벨 인라인 가이드 */}
                  <Step1InlineGuide focus={step1Focus} form={storeForm} customBtype={customBtype} voiceEnabled={voiceEnabled} />

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1.5">① 매장 이름 *</label>
                      <input type="text" aria-label="매장 이름" value={storeForm.name}
                        onChange={e => setStoreForm(p => ({...p, name: e.target.value}))}
                        onFocus={() => setStep1Focus('name')}
                        placeholder="예: 홍길동 카페"
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:bg-white/15 transition-all text-sm font-bold" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2">② 업종 *</label>
                      <BusinessTypePicker
                        value={storeForm.business_type}
                        customValue={customBtype}
                        onChange={v => setStoreForm(p => ({...p, business_type: v}))}
                        onCustomChange={setCustomBtype}
                        onPickerFocus={() => setStep1Focus('business_type')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><Clock size={11} /> ③ 영업 시작</label>
                        <input type="time" aria-label="영업 시작 시간" value={storeForm.open_time}
                          onChange={e => setStoreForm(p => ({...p, open_time: e.target.value}))}
                          onFocus={() => setStep1Focus('time')}
                          className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><Clock size={11} /> 영업 마감</label>
                        <input type="time" aria-label="영업 마감 시간" value={storeForm.close_time}
                          onChange={e => setStoreForm(p => ({...p, close_time: e.target.value}))}
                          onFocus={() => setStep1Focus('time')}
                          className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><Phone size={11} /> ④ 연락처 (선택)</label>
                      <input type="tel" aria-label="연락처" value={storeForm.phone}
                        onChange={e => setStoreForm(p => ({...p, phone: e.target.value}))}
                        onFocus={() => setStep1Focus('phone')}
                        placeholder="010-1234-5678"
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1.5 flex items-center gap-1"><MapPin size={11} /> ⑤ 주소 (선택)</label>
                      <input type="text" aria-label="주소" value={storeForm.address}
                        onChange={e => setStoreForm(p => ({...p, address: e.target.value}))}
                        onFocus={() => setStep1Focus('address')}
                        placeholder="서울시 강남구..."
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-400 block mb-1.5">⑥ 매장 소개 (선택)</label>
                      <textarea rows={2} value={storeForm.description}
                        onChange={e => setStoreForm(p => ({...p, description: e.target.value}))}
                        onFocus={() => setStep1Focus('description')}
                        placeholder="매장에 대한 간단한 소개"
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all text-sm resize-none" />
                    </div>
                  </div>
                  {errorMsg && (
                    <div className="mt-4 px-4 py-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-sm font-bold text-center">
                      {errorMsg}
                    </div>
                  )}
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setStep(0)} className="px-5 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-1.5">
                      <ArrowLeft size={14} /> 이전
                    </button>
                    <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }} onClick={handleSaveStore}
                      disabled={!storeForm.name.trim() || saving}
                      className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                      {saving ? <><Loader2 size={16} className="animate-spin" /> 저장 중...</> : <>매장 저장 <ArrowRight size={14} /></>}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: 메뉴 등록 ── */}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7">
                  <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2"><ChefHat size={20} className="text-amber-400" /> 메뉴 등록</h2>
                  <div className="flex items-center gap-3 mb-5 px-3 py-2.5 bg-gradient-to-r from-violet-500/[0.08] to-purple-500/[0.05] rounded-2xl border border-violet-500/20">
                    <div className="relative flex-shrink-0 w-[38px] h-[38px]">
                      <motion.div className="relative w-[38px] h-[38px]"
                        animate={{ y:[-3,5,-3], rotate:[-2.5,2.5,-2.5] }}
                        transition={{ duration:3.2, repeat:Infinity, ease:'easeInOut' }}>
                        <motion.div className="absolute inset-0 -m-1.5 rounded-full"
                          style={{ background:'radial-gradient(circle, rgba(139,92,246,.5) 0%, transparent 72%)' }}
                          animate={{ scale:[1,1.2,1], opacity:[0.5,0.9,0.5] }}
                          transition={{ duration:2.3, repeat:Infinity, ease:'easeInOut' }} />
                        <Wing side="left" /><Wing side="right" />
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[24px] h-[24px] rounded-full flex items-center justify-center"
                          style={{ background:'radial-gradient(circle at 34% 28%, #FFF8E7, #F59E0B 62%, #D97706)', boxShadow:'0 2px 10px rgba(245,159,11,.5)' }}>
                          <svg viewBox="0 0 24 24" fill="white" width="12" height="12">
                            <path d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
                          </svg>
                        </div>
                      </motion.div>
                    </div>
                    <p className="text-[12px] font-bold text-violet-200 leading-relaxed flex-1">
                      메뉴 이름을 입력한 뒤 <span className="text-violet-300 font-black">AI ✨ 버튼</span>을 눌러보세요! 설명과 가격을 자동으로 완성해드려요.
                    </p>
                  </div>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {menuItems.map((item, idx) => (
                      <motion.div key={idx} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex gap-2 mb-2">
                          <input type="text" aria-label="메뉴 이름" value={item.name} onChange={e => updateMenuItem(idx, 'name', e.target.value)}
                            onFocus={() => {
                              if (!item.name.trim()) {
                                sayWithDelay(pickRandom([
                                  '대표 메뉴 이름을 입력해보세요! AI가 설명과 가격을 완성해줄게요!',
                                  '메뉴 이름 입력 후 AI 버튼을 눌러보세요!',
                                  '어떤 메뉴를 판매하시나요? 이름만 입력하면 AI가 도와드려요!',
                                ]), 0);
                              }
                            }}
                            placeholder="메뉴 이름 (예: 아메리카노)"
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm font-bold focus:outline-none focus:border-amber-500/50 transition-all" />
                          <input type="number" aria-label="메뉴 가격" value={item.price} onChange={e => updateMenuItem(idx, 'price', e.target.value)}
                            placeholder="가격"
                            className="w-24 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm font-bold focus:outline-none focus:border-amber-500/50 transition-all" />
                        </div>
                        <div className="flex gap-2">
                          <input type="text" aria-label="메뉴 설명" value={item.description} onChange={e => updateMenuItem(idx, 'description', e.target.value)}
                            placeholder="메뉴 설명 (AI 자동완성 가능)"
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-xs focus:outline-none focus:border-amber-500/50 transition-all" />
                          <button onClick={() => handleAISuggest(idx)} disabled={aiLoadingIdx === idx}
                            className="px-3 py-2 bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-violet-300 rounded-xl text-xs font-black hover:from-violet-500/30 transition-all disabled:opacity-50 flex items-center gap-1 flex-shrink-0">
                            {aiLoadingIdx === idx ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} AI
                          </button>
                          {menuItems.length > 1 && (
                            <button onClick={() => removeMenuItem(idx)} className="p-2 text-rose-400/60 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-all">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <button onClick={addMenuItem}
                    className="mt-3 w-full py-2.5 border border-dashed border-white/20 text-slate-500 rounded-2xl text-sm font-bold hover:border-amber-500/30 hover:text-amber-400 transition-all flex items-center justify-center gap-1.5">
                    <Plus size={14} /> 메뉴 추가
                  </button>
                  <div className="flex gap-3 mt-5">
                    <button onClick={() => setStep(1)} className="px-5 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-1.5">
                      <ArrowLeft size={14} /> 이전
                    </button>
                    <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }} onClick={handleSaveMenus} disabled={saving}
                      className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                      {saving ? <><Loader2 size={16} className="animate-spin" /> 저장 중...</> : <>메뉴 저장 <ArrowRight size={14} /></>}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 3: 테이블 설정 ── */}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7">
                  <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2"><LayoutGrid size={20} className="text-amber-400" /> 테이블 설정</h2>
                  <p className="text-xs text-slate-500 mb-4">테이블을 추가하거나 삭제해보세요. QR 주문 시 테이블 번호가 표시돼요.</p>

                  <div className="flex items-center gap-2.5 mb-4 px-3 py-2.5 bg-gradient-to-r from-amber-500/[0.07] to-orange-500/[0.04] rounded-2xl border border-amber-500/20">
                    <span className="text-base flex-shrink-0">✨</span>
                    <p className="text-[12px] font-bold text-amber-200/80 leading-relaxed">
                      기본 테이블 3개가 자동 추가됐어요! 필요에 따라 삭제하거나 더 추가해보세요.
                    </p>
                  </div>

                  {/* 테이블 카드 리스트 */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {layoutTables.length === 0 && (
                      <div className="py-10 text-center text-slate-600 text-sm font-bold">
                        테이블을 추가해주세요
                      </div>
                    )}
                    <AnimatePresence>
                      {layoutTables.map((table, idx) => {
                        const isBase = table.table_number === '기본QR';
                        return (
                          <motion.div
                            key={table.id}
                            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, x:-20, height:0 }}
                            transition={{ delay: idx * 0.04 }}
                            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all ${
                              isBase
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-white/5 border-white/10 hover:border-white/20'
                            }`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isBase ? 'bg-amber-500/20' : 'bg-slate-700/70'
                            }`}>
                              {isBase
                                ? <QrCode size={16} className="text-amber-400" />
                                : <LayoutGrid size={16} className="text-slate-300" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-black truncate ${isBase ? 'text-amber-300' : 'text-white'}`}>
                                {table.table_number}
                              </p>
                              <p className={`text-[11px] ${isBase ? 'text-amber-500/80' : 'text-slate-500'}`}>
                                {isBase ? '매장 공통 QR — 테이블 미지정 주문용' : `${table.capacity}인석`}
                              </p>
                            </div>
                            {!isBase && (
                              <button
                                onClick={() => handleDeleteTable(table.id)}
                                className="p-2 text-rose-400/50 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-all flex-shrink-0"
                              >
                                <X size={15} />
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center justify-between mt-3 mb-1">
                    <span className="text-xs text-slate-500 font-bold">
                      총 <span className="text-white">{layoutTables.length}</span>개
                      <span className="ml-1 text-slate-600">(기본QR 포함)</span>
                    </span>
                    <button
                      onClick={() => setAddingTable(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:border-amber-500/30 hover:text-amber-400 text-slate-400 rounded-xl text-xs font-bold transition-all">
                      <Plus size={12} /> 테이블 추가
                    </button>
                  </div>

                  {/* 테이블 추가 패널 */}
                  <AnimatePresence>
                    {addingTable && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                        className="overflow-hidden">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-2 space-y-2">
                          <input type="text" aria-label="테이블 이름" value={newTableName} onChange={e => setNewTableName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTable()}
                            placeholder="테이블 이름 (예: 테이블04, 룸A, 야외1)"
                            className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm font-bold focus:outline-none focus:border-amber-500/50 transition-all" />
                          <div className="flex gap-2">
                            <select value={newTableCap} onChange={e => setNewTableCap(Number(e.target.value))}
                              className="flex-1 px-3 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-all">
                              {[2,4,6,8,10].map(n => <option key={n} value={n}>{n}인석</option>)}
                            </select>
                            <button onClick={handleAddTable} disabled={!newTableName.trim() || saving}
                              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-black disabled:opacity-40 transition-all flex items-center justify-center gap-1.5">
                              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} 추가
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 드래그 가능 가상 캔버스는 데스크탑 해상도 대응용으로 백그라운드 렌더 유지 */}
                  <div ref={canvasRef} style={{ display: 'none' }}>
                    {layoutTables.map(t => (
                      <TableLayoutCard
                        key={t.id}
                        table={t}
                        canvasRef={canvasRef}
                        onMove={handleMoveTable}
                        onDelete={handleDeleteTable}
                      />
                    ))}
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button onClick={() => setStep(2)} className="px-5 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-1.5">
                      <ArrowLeft size={14} /> 이전
                    </button>
                    <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }} onClick={handleSaveLayout} disabled={saving}
                      className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/20 disabled:opacity-40 flex items-center justify-center gap-2">
                      {saving ? <><Loader2 size={16} className="animate-spin" /> 저장 중...</> : <>다음 단계 <ArrowRight size={14} /></>}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 4: QR 코드 A4 인쇄 ── */}
              {step === 4 && (
                <motion.div key="s4" initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-30 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-7">
                  <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2"><QrCode size={20} className="text-amber-400" /> QR 코드 출력</h2>

                  <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
                    className="flex items-center gap-3 mb-4 px-4 py-3 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 rounded-2xl border border-emerald-500/25">
                    <motion.div animate={{ rotate:[0,10,-10,0], scale:[1,1.1,1] }} transition={{ duration:1, repeat:Infinity, repeatDelay:2 }}
                      className="text-xl flex-shrink-0">🎉</motion.div>
                    <div className="flex-1">
                      <p className="text-[13px] font-black text-emerald-300">매장 설정 완료!</p>
                      <p className="text-[11px] text-emerald-400/80">A4 한 장에 4개씩 인쇄됩니다. 코팅 후 각 테이블에 붙여두세요!</p>
                    </div>
                  </motion.div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {['📄 A4 자동 4분할','🏪 매장 로고·상호','📞 전화번호','📱 스캔 안내문'].map(t => (
                      <span key={t} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[11px] text-slate-400 font-bold">{t}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 mb-4">
                    {layoutTables.map(table => {
                      const isBase = table.table_number === '기본QR';
                      return (
                        <div key={table.id} className="bg-white rounded-2xl border border-slate-100 flex flex-col items-center p-3 gap-1 overflow-hidden"
                          style={{ borderTop: '3px solid #f59e0b' }}>
                          <div className="flex items-center gap-1.5 w-full justify-center mb-1">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg,#f59e0b,#ea580c)' }}>{initial}</div>
                            <p className="text-[10px] font-black text-slate-800 truncate">{storeName}</p>
                          </div>
                          <img src={getQrImgUrl(table)} alt={`QR ${table.table_number}`}
                            className="w-20 h-20" loading="eager" />
                          {isBase && <span className="text-[8px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">매장 공통</span>}
                          <p className="text-[11px] font-black text-slate-800 text-center">{isBase ? '테이블 없이 주문' : table.table_number}</p>
                          {phone && <p className="text-[9px] text-slate-500">☎ {phone}</p>}
                          <div className="w-full h-px bg-slate-100 my-0.5" />
                          <p className="text-[8px] text-slate-400 text-center leading-tight">📱 QR스캔 → 메뉴 → 주문</p>
                        </div>
                      );
                    })}
                  </div>

                  <div id="qr-print-area">
                    {layoutTables.map(t => renderPrintCard(t))}
                  </div>

                  <p className="text-[11px] text-slate-600 text-center mb-4">
                    💡 5장 이상은 자동으로 다음 페이지 · 코팅 후 사용 시 오래 써요
                  </p>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(3)} className="px-5 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-1.5">
                      <ArrowLeft size={14} /> 이전
                    </button>
                    <button onClick={() => {
                      sayWithDelay(pickRandom([
                        'QR 인쇄 시작! 코팅해서 테이블에 붙여두면 더 오래 쓸 수 있어요!',
                        '인쇄 후 각 테이블에 붙여두면 손님이 바로 주문할 수 있어요!',
                      ]), 0);
                      window.print();
                    }}
                      className="flex-1 py-3 bg-gradient-to-r from-slate-700 to-slate-600 border border-slate-500/50 text-white rounded-2xl font-bold text-sm hover:from-slate-600 transition-all flex items-center justify-center gap-2">
                      🖨️ A4 인쇄
                    </button>
                    <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }} onClick={handleFinish}
                      className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                      <PartyPopper size={15} /> 설정 완료!
                    </motion.button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            <div className="flex justify-end">
              <WizardTinkerbell message={tbMsg} isHappy={tbHappy} voiceEnabled={voiceEnabled} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
