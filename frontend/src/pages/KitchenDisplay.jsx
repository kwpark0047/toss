import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { 
  Play, CheckCircle2, RefreshCw, Printer, Volume2, VolumeX, 
  Wifi, WifiOff, Clock, User, ChevronRight, Hash, XCircle, Keyboard, Megaphone, Bluetooth
} from 'lucide-react';
import{ connectKitchen, getSocket } from '../utils/socket';
import notificationSound, { vibrateShort, vibrateOrderReady } from '../utils/notificationSound';
import { usePrinter } from '../hooks/usePrinter';

export default function KitchenDisplay() {
  const { t } = useTranslation();
  const { storeId } = useParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true); // AI 음성 방송 활성화 여부
  const [voiceLogs, setVoiceLogs] = useState([]); // 음성 방송 기록 로그
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilteredType] = useState('ALL'); // ALL, DINE_IN, TAKEOUT
  const [socketStatus, setSocketStatus] = useState('DISCONNECTED');
  const [updatingId, setUpdatingId] = useState(null);

  const { printerDevice, isConnecting, isSupported, connectPrinter, printReceipt } = usePrinter();

  // 개별 주문의 조리 체크 아이템 상태 관리 (KDS 작업자들이 항목 클릭 시 완료선 긋기 용도)
  const [checkedItems, setCheckedItems] = useState({}); // { [order_id + '-' + item_id]: boolean }

  const timerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // 주문 전입 모니터링 수집기용 Ref (신규 주문 실시간 음성 방송 호출 장치 연동)
  const knownOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  // 현재 경과 시간 초 갱신 타이머
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // API로부터 매장별 KDS 활성 주문 로드
  const fetchKdsOrders = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch(`/api/v1/kds/stores/${storeId}/orders`);
      if (!res.ok) throw new Error(t('kds.fetch_error'));
      const json = await res.json();
      setOrders(json.data || json || []);
    } catch (err) {
      console.error('[KDS] Fetch Error:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchKdsOrders(true);
      
      // 주방 전용 소켓 룸 입장
      connectKitchen(storeId);
      
      const rawSocket = getSocket();
      if (rawSocket.connected) {
        setSocketStatus('CONNECTED');
      }

      // 소켓 상태 이벤트 핸들러
      const handleConnect = () => setSocketStatus('CONNECTED');
      const handleDisconnect = () => setSocketStatus('DISCONNECTED');

      // 실시간 KDS 주문 갱신 이벤트 핸들러
      const handleOrderUpdated = (data) => {
        if (parseInt(data.storeId || data.store_id) === parseInt(storeId)) {
          // 실시간 리프레시 수행
          fetchKdsOrders(false);

          if (soundEnabled) {
            if (data.status === 'pending') {
              notificationSound.playNewOrder();
              vibrateShort();
            } else if (data.status === 'ready') {
              notificationSound.playOrderReady();
              vibrateOrderReady();
            } else {
              notificationSound.playSuccess();
              vibrateShort();
            }
          }
        }
      };

      // 새 주문이 접수되었을 때 실시간 트리거
      const handleNewOrder = (data) => {
        if (parseInt(data.store_id || data.storeId) === parseInt(storeId)) {
          fetchKdsOrders(false);
          if (soundEnabled) {
            notificationSound.playNewOrder();
            vibrateShort();
          }
        }
      };

      rawSocket.on('connect', handleConnect);
      rawSocket.on('disconnect', handleDisconnect);
      rawSocket.on('kds:order_updated', handleOrderUpdated);
      rawSocket.on('new-order', handleNewOrder);
      rawSocket.on('order_updated', handleOrderUpdated); // 상호 대체 리스너

      return () => {
        rawSocket.off('connect', handleConnect);
        rawSocket.off('disconnect', handleDisconnect);
        rawSocket.off('kds:order_updated', handleOrderUpdated);
        rawSocket.off('new-order', handleNewOrder);
        rawSocket.off('order_updated', handleOrderUpdated);
      };
    }
  }, [storeId, soundEnabled]);

  // 실시간 주문 수신 및 신규 주문 인디케이터 수집 (실시간 KDS 주문 보이스 방송 연동)
  useEffect(() => {
    if (orders.length === 0) return;

    const currentIds = new Set(orders.map(o => o.id));

    // 최초 렌더 시에는 소리 내어 읽지 않고 아이디만 색인에 캐시
    if (isFirstLoadRef.current) {
      knownOrderIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }

    // 신규 수신 주문 색인 감지
    const freshOrders = orders.filter(o => !knownOrderIdsRef.current.has(o.id));
    if (freshOrders.length > 0 && voiceEnabled) {
      freshOrders.forEach(order => {
        // 접수 대기('pending') 또는 결제 완료('paid') 상태일 때만 자동 음성 방송
        if (order.status === 'pending' || order.status === 'paid' || order.status === 'confirmed') {
          speakOrderVocal(order);
        }
      });
    }

    knownOrderIdsRef.current = currentIds;
  }, [orders, voiceEnabled]);

  // 주문 상태 업데이트 핸들러
  const handleUpdateStatus = async (orderId, nextStatus) => {
    try {
      setUpdatingId(orderId);
      const res = await fetch(`/api/v1/kds/stores/${storeId}/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) throw new Error(t('kds.status_update_failed'));
      
      if (soundEnabled) {
        notificationSound.playSuccess();
        vibrateShort();
      }

      // KDS 주문 목록 로컬 상태에서 즉각 제거/업데이트
      if (nextStatus === 'completed' || nextStatus === 'cancelled') {
        setOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));
      }

      if (nextStatus === 'preparing' && printerDevice) {
        const orderToPrint = orders.find(o => o.id === orderId);
        if (orderToPrint) {
          printReceipt(orderToPrint);
        }
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // 주방 영수증 강제 재인쇄 생성 API 호출
  const handleReprintSlip = async (orderId) => {
    try {
      setUpdatingId(orderId);
      if (printerDevice) {
        const orderToPrint = orders.find(o => o.id === orderId);
        if (orderToPrint) {
          const success = await printReceipt(orderToPrint);
          if (success) {
            alert(t('kds.print.success'));
            return;
          }
        }
      }
      
      const res = await fetch(`/api/v1/kds/stores/${storeId}/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'preparing' })
      });
      if (!res.ok) throw new Error(t('kds.print.failed'));
      alert(t('kds.print.queued'));
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // 개별 식자재 항목 조리 완료 체크 토글
  const toggleCheckItem = (orderId, itemId) => {
    const key = `${orderId}-${itemId}`;
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    vibrateShort();
  };

  // 경과 시간 계산 유틸 (분:초 형식 포맷팅)
  const formatElapsedTime = (createdAtString) => {
    const elapsedMs = currentTime - new Date(createdAtString).getTime();
    if (elapsedMs < 0) return '00:00';
    const totalSecs = Math.floor(elapsedMs / 1000);
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // 경과 시간에 따른 위급 상태 클래스 반환 (5분 이상: 오렌지색 경고, 10분 이상: 빨간색 비상 지연)
  const getTimerSeverityClass = (createdAtString) => {
    const elapsedMs = currentTime - new Date(createdAtString).getTime();
    const mins = elapsedMs / 1000 / 60;
    if (mins >= 10) return 'bg-rose-500/10 text-rose-500 border-rose-500/30 animate-pulse';
    if (mins >= 5) return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  };

  // 검색 및 포장 여부에 따른 필터링 적용
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.includes(searchQuery) ||
      (order.table_name && order.table_name.includes(searchQuery)) ||
      (order.customer_name && order.customer_name.includes(searchQuery));
    
    if (filterType === 'DINE_IN') return matchesSearch && !order.is_takeout;
    if (filterType === 'TAKEOUT') return matchesSearch && order.is_takeout;
    return matchesSearch;
  });

  const pendingOrders = filteredOrders.filter(o => o.status === 'pending');
  const preparingOrders = filteredOrders.filter(o => o.status === 'preparing');
  const readyOrders = filteredOrders.filter(o => o.status === 'ready');

  // 키보드 단축키 핸들러 (KDS 주방 무선 조작 가동을 위한 고도화)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 입력 필드 포커싱 상태면 단축키 바인딩 차단
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();

      // 1. KDS 필터 전환 (1: 전체, 2: 매장, 3: 포장)
      if (key === '1') {
        setFilteredType('ALL');
        vibrateShort();
      } else if (key === '2') {
        setFilteredType('DINE_IN');
        vibrateShort();
      } else if (key === '3') {
        setFilteredType('TAKEOUT');
        vibrateShort();
      }

      // 2. 사운드 볼륨 음소거 토글 (q)
      if (key === 'q') {
        setSoundEnabled(prev => !prev);
        vibrateShort();
      }

      // 3. 접수 대기(PENDING) 가장 오래된 주문 즉시 접수 (p)
      if (key === 'p') {
        if (pendingOrders.length > 0) {
          const oldestOrder = pendingOrders[0];
          handleUpdateStatus(oldestOrder.id, 'preparing');
        }
      }

      // 4. 조리 중(PREPARING) 가장 오래된 주문 조리 완료 (r)
      if (key === 'r') {
        if (preparingOrders.length > 0) {
          const oldestOrder = preparingOrders[0];
          handleUpdateStatus(oldestOrder.id, 'ready');
        }
      }

      // 5. 수령 대기(READY) 가장 오래된 주문 수령 인도 완료 (c)
      if (key === 'c') {
        if (readyOrders.length > 0) {
          const oldestOrder = readyOrders[0];
          handleUpdateStatus(oldestOrder.id, 'completed');
        }
      }

      // 6. 새로고침 및 데이터 싱크 (Space)
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        fetchKdsOrders(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingOrders, preparingOrders, readyOrders, soundEnabled]);

  // 실시간 주방 주문 음성 안내 방송 처리기 (Web Speech API TTS 연동)
  const speakOrderVocal = (order) => {
    if (!('speechSynthesis' in window)) {
      console.warn('[TTS] 이 브라우저는 Web Speech Synthesis API를 지원하지 않습니다.');
      return;
    }

    // 재생 대기열 초기화 후 신규 오더 즉시 점유
    window.speechSynthesis.cancel();

    const tableLabel = order.is_takeout ? t('kds.labels.takeout') : t('kds.labels.table', { name: order.table_name || '일반' });
    
    let itemsLabel = '';
    const itemsList = order.items || order.order_items || [];
    if (itemsList.length > 0) {
      itemsList.forEach((item) => {
        itemsLabel += `${item.product_name} ${item.quantity}개, `;
      });
      itemsLabel = itemsLabel.slice(0, -2); // 마지막 쉼표 제거
    }

    const textToSpeak = t('kds.tts.new_order', { table: tableLabel, items: itemsLabel });

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.0; // 자연스러운 속도
    utterance.pitch = 1.0; // 정밀 톤

    // 가용한 한국어 화자 목소리 탐색 매핑
    const voices = window.speechSynthesis.getVoices();
    const koVoice = voices.find(v => v.lang.includes('KO') || v.lang.includes('ko'));
    if (koVoice) {
      utterance.voice = koVoice;
    }

    // 방송 로그 기록 누적 (최근 5건)
    setVoiceLogs(prev => [
      {
        id: Math.random().toString(36).substring(2, 8),
        text: `${tableLabel} ➡️ ${itemsLabel}`,
        time: new Date().toLocaleTimeString('ko-KR', { hour12: false })
      },
      ...prev
    ].slice(0, 5));

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 flex flex-col h-screen select-none">
      {/* KDS 최상단 상단바 헤더 */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 text-white p-3 rounded-xl shadow-lg shadow-orange-500/10">
            <Printer className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight">
              {t('kds.title')}
              <span className="text-xs font-mono font-normal text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Advanced KDS v1.2
              </span>
            </h1>
            <p className="text-xs text-slate-400">{t('kds.subtitle')}</p>
          </div>
        </div>

        {/* 상단 컨트롤 패널 (터치 피드백 강화 및 48px 터치 영역 충족) */}
        <div className="flex items-center gap-2.5">
          {isSupported && (
            <button
              onClick={connectPrinter}
              disabled={isConnecting}
              className={`px-4 h-12 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all active:scale-95 ${
                printerDevice 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
              }`}
            >
              <Bluetooth className={`size-4 ${isConnecting ? 'animate-pulse' : ''}`} />
              <span className="font-mono text-xs uppercase font-bold">
                {printerDevice ? 'PRINTER ON' : 'CONNECT PRINTER'}
              </span>
            </button>
          )}

          {/* 소켓 연결 표시등 */}
          <div className={`flex items-center gap-1.5 px-4 h-12 rounded-xl text-xs font-mono border ${
            socketStatus === 'CONNECTED' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
          }`}>
            {socketStatus === 'CONNECTED' ? (
              <>
                <Wifi className="size-3.5" />
                <span>ONLINE</span>
              </>
            ) : (
              <>
                <WifiOff className="size-3.5" />
                <span>OFFLINE (RETRY)</span>
              </>
            )}
          </div>

          {/* AI TTS 라이브 스피커 토글 (48px 터치 영역 충족) */}
          <button 
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`px-4 h-12 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all active:scale-95 ${
              voiceEnabled 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Megaphone className={`size-4 ${voiceEnabled ? 'animate-bounce' : ''}`} />
            <span className="font-mono text-xs uppercase font-bold">{voiceEnabled ? 'VOICE ON' : 'VOICE OFF'}</span>
          </button>

          {/* 사운드 활성 토글 (48px 터치 영역 충족) */}
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-4 h-12 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all active:scale-95 ${
              soundEnabled 
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' 
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            <span className="font-mono text-xs uppercase font-bold">{soundEnabled ? 'BELL ON' : 'BELL MUTED'}</span>
          </button>

          {/* 수동 리프레시 버튼 (48px 터치 영역 충족) */}
          <button 
            onClick={() => fetchKdsOrders(true)}
            disabled={loading}
            className="w-12 h-12 rounded-xl border border-slate-850 bg-slate-900 hover:bg-slate-850 text-slate-300 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* 필터 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-3 my-3">
        {/* 포장/매장 필터 칩 (48px 터치 영역 충족 및 모션 효과 적용) */}
        <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800">
          {[
            { id: 'ALL', label: t('kds.filters.all') },
            { id: 'DINE_IN', label: t('kds.filters.dine_in') },
            { id: 'TAKEOUT', label: t('kds.filters.takeout') }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilteredType(opt.id)}
              className={`px-5 h-10 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                filterType === opt.id 
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/10' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 대기 주문 검색 바 */}
        <div className="relative max-w-md w-full md:w-80">
          <input 
            type="text"
            placeholder={t('kds.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-orange-500 placeholder-slate-500 transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
            >
              <XCircle className="size-4" />
            </button>
          )}
        </div>
      </div>

      {loading && orders.length === 0 ? (
        /* 스켈레톤 로딩 */
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(col => (
            <div key={col} className="bg-slate-900/40 rounded-xl border border-slate-850 p-4 animate-pulse flex flex-col gap-4">
              <div className="h-4 bg-slate-800 rounded w-1/3"></div>
              <div className="h-32 bg-slate-800 rounded-lg"></div>
              <div className="h-32 bg-slate-800 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : (
        /* 메인 3컬럼 KDS 보드 레이아웃 */
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden min-h-0">
          {/* 컬럼 1: 접수 대기 (PENDING) */}
          <div className="bg-slate-900/30 rounded-xl border border-slate-900 flex flex-col min-h-0">
            <div className="p-3.5 bg-slate-900/50 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-xs font-bold text-amber-400 tracking-wider flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                {t('kds.columns.pending')}
              </h2>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400">
                {pendingOrders.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
              {pendingOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 py-10">
                  <Clock className="size-8 stroke-[1.5] mb-2 opacity-50" />
                  <p className="text-xs">{t('kds.empty.pending')}</p>
                </div>
              ) : (
                pendingOrders.map(order => (
                  <div 
                    key={order.id} 
                    className="bg-slate-900 border border-amber-500/20 hover:border-amber-500/40 rounded-xl overflow-hidden transition-all shadow-sm"
                  >
                    <div className="p-3.5 border-b border-slate-850/60 bg-amber-500/[0.02] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-100">
                          #{order.order_number.slice(-4)}
                        </span>
                        <span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold ${
                          order.is_takeout ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {order.is_takeout ? t('kds.labels.takeout') : `${order.table_name || t('kds.labels.table_fallback')}번`}
                        </span>
                      </div>
                      <div className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border ${getTimerSeverityClass(order.created_at)}`}>
                        {formatElapsedTime(order.created_at)}
                      </div>
                    </div>

                    {/* 주문 내역 */}
                    <div className="p-3.5 flex flex-col gap-2">
                      <ul className="divide-y divide-slate-850/50">
                        {order.items.map(item => (
                          <li key={item.id} className="py-1.5 flex flex-col text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-200">{item.product_name}</span>
                              <span className="font-mono font-bold text-orange-400 text-sm">x{item.quantity}</span>
                            </div>
                            {item.options && (
                              <div className="text-[10px] text-slate-500 mt-0.5 font-sans leading-relaxed">
                                {Object.entries(JSON.parse(item.options)).map(([k, v]) => `${k}: ${v}`).join(', ')}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>

                      {order.notes && (
                        <div className="text-[10px] bg-slate-950 p-2.5 rounded-lg text-slate-400 border border-slate-900 leading-relaxed">
                          <strong className="text-amber-500">{t('kds.labels.notes')}</strong> {order.notes}
                        </div>
                      )}

                      {/* 액션 버튼 (48px 터치 영역 충족 및 스케일 모션 적용) */}
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'preparing')}
                        disabled={updatingId === order.id}
                        className="w-full mt-2 h-12 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-amber-500/10"
                      >
                        <Play className="size-3.5 fill-current" />
                        {t('kds.actions.accept')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 컬럼 2: 조리 중 (PREPARING) */}
          <div className="bg-slate-900/30 rounded-xl border border-slate-900 flex flex-col min-h-0">
            <div className="p-3.5 bg-slate-900/50 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-xs font-bold text-sky-400 tracking-wider flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                {t('kds.columns.preparing')}
              </h2>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400">
                {preparingOrders.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
              {preparingOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 py-10">
                  <Printer className="size-8 stroke-[1.5] mb-2 opacity-50" />
                  <p className="text-xs">{t('kds.empty.preparing')}</p>
                </div>
              ) : (
                preparingOrders.map(order => (
                  <div 
                    key={order.id} 
                    className="bg-slate-900 border border-sky-500/20 hover:border-sky-500/40 rounded-xl overflow-hidden transition-all shadow-sm"
                  >
                    <div className="p-3.5 border-b border-slate-850/60 bg-sky-500/[0.02] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-100">
                          #{order.order_number.slice(-4)}
                        </span>
                        <span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold ${
                          order.is_takeout ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {order.is_takeout ? t('kds.labels.takeout') : `${order.table_name || t('kds.labels.table_fallback')}번`}
                        </span>
                      </div>
                      <div className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border ${getTimerSeverityClass(order.created_at)}`}>
                        {formatElapsedTime(order.created_at)}
                      </div>
                    </div>

                    {/* 인터랙티브 체크아이템 주문 상품 목록 */}
                    <div className="p-3.5 flex flex-col gap-2">
                      <ul className="divide-y divide-slate-850/50">
                        {order.items.map(item => {
                          const isChecked = checkedItems[`${order.id}-${item.id}`];
                          return (
                            <li 
                              key={item.id} 
                              onClick={() => toggleCheckItem(order.id, item.id)}
                              className={`py-1.5 flex flex-col cursor-pointer transition-all ${
                                isChecked ? 'opacity-40 line-through' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-block w-4 h-4 rounded border text-[10px] flex items-center justify-center font-bold font-mono transition-all ${
                                    isChecked ? 'bg-sky-500 border-sky-500 text-slate-950' : 'border-slate-700 hover:border-sky-500'
                                  }`}>
                                    {isChecked && '✓'}
                                  </span>
                                  <span className="font-medium text-slate-200">{item.product_name}</span>
                                </div>
                                <span className="font-mono font-bold text-sky-400 text-sm">x{item.quantity}</span>
                              </div>
                              {item.options && (
                                <div className="text-[10px] text-slate-500 ml-6 mt-0.5 font-sans leading-relaxed">
                                  {Object.entries(JSON.parse(item.options)).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>

                      {order.notes && (
                        <div className="text-[10px] bg-slate-950 p-2.5 rounded-lg text-slate-400 border border-slate-900 leading-relaxed">
                          <strong className="text-sky-500">{t('kds.labels.notes')}</strong> {order.notes}
                        </div>
                      )}

                      {/* 슬립 인쇄 대기열 강제 재등록 단추 (48px 터치 영역 충족) */}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleReprintSlip(order.id)}
                          disabled={updatingId === order.id}
                          title="주방 인쇄 작업 강제 추가"
                          className="w-12 h-12 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-750 disabled:opacity-50 text-slate-400 hover:text-slate-200 rounded-xl font-medium text-xs flex items-center justify-center transition-all active:scale-95"
                        >
                          <Printer className="size-4" />
                        </button>
                        
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'ready')}
                          disabled={updatingId === order.id}
                          className="flex-1 h-12 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-slate-950 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-sky-500/10"
                        >
                          <CheckCircle2 className="size-3.5" />
                          {t('kds.actions.complete')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 컬럼 3: 수령 대기 (READY) 및 보이스 브로드캐스트 모니터링 결합 */}
          <div className="bg-slate-900/30 rounded-xl border border-slate-900 flex flex-col min-h-0">
            <div className="p-3.5 bg-slate-900/50 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-xs font-bold text-emerald-400 tracking-wider flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                {t('kds.columns.ready')}
              </h2>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">
                {readyOrders.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0 justify-between">
              {/* 조리 완료 대기 목록 */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-3">
                {readyOrders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 py-10">
                    <CheckCircle2 className="size-8 stroke-[1.5] mb-2 opacity-50" />
                    <p className="text-xs">{t('kds.empty.ready')}</p>
                  </div>
                ) : (
                  readyOrders.map(order => (
                    <div 
                      key={order.id} 
                      className="bg-slate-900 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl overflow-hidden transition-all shadow-sm"
                    >
                      <div className="p-3.5 border-b border-slate-850/60 bg-emerald-500/[0.02] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-100">
                            #{order.order_number.slice(-4)}
                          </span>
                          <span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold ${
                            order.is_takeout ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {order.is_takeout ? t('kds.labels.takeout') : `${order.table_name || t('kds.labels.table_fallback')}번`}
                          </span>
                        </div>
                        <div className="text-[10px] px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg font-mono font-bold">
                          CALLING...
                        </div>
                      </div>

                      {/* 수령 정보 카드 */}
                      <div className="p-3.5 flex flex-col gap-2">
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/60 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <User className="size-3.5" />
                            <span>{t('kds.info.phone')}</span>
                            <span className="font-mono text-slate-200">
                              {order.customer_phone ? '010-****-' + order.customer_phone.slice(-4) : t('kds.info.no_registration')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Hash className="size-3.5" />
                            <span>{t('kds.info.wait_order')}</span>
                            <span className="font-mono text-slate-200">
                              {order.queue_number ? `${order.queue_number}번` : t('kds.info.no_info')}
                            </span>
                          </div>
                        </div>

                        {/* 상품 요약 */}
                        <ul className="text-xs text-slate-400 px-1 py-1 divide-y divide-slate-850/40">
                          {order.items.map(item => (
                            <li key={item.id} className="py-1 flex items-center justify-between">
                              <span>{item.product_name}</span>
                              <span className="font-mono font-bold">x{item.quantity}</span>
                            </li>
                          ))}
                        </ul>

                        {/* 액션 버튼 (48px 터치 영역 충족) */}
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'completed')}
                          disabled={updatingId === order.id}
                          className="w-full mt-2 h-12 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-emerald-500/10"
                        >
                          <CheckCircle2 className="size-3.5" />
                          {t('kds.actions.pickup')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 실시간 AI 음성 방송 텍스트 브로드캐스트 현장 모니터 전광판 (UI 결합 추가) */}
              {voiceEnabled && (
                <div className="mt-4 p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-3 shrink-0 text-left">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Megaphone className="size-4 text-rose-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-300">{t('kds.voice.title')}</span>
                  </div>
                  {voiceLogs.length === 0 ? (
                    <p className="text-[10px] text-slate-600 font-semibold italic text-center py-2">
                      {t('kds.voice.empty')}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-24 overflow-y-auto">
                      {voiceLogs.map(log => (
                        <div key={log.id} className="flex justify-between items-center text-[9px] font-mono leading-none">
                          <span className="text-slate-300 truncate max-w-[150px] font-bold">&gt; {log.text}</span>
                          <span className="text-slate-500 shrink-0">{log.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 키보드 단축키 안내판 (inline help 가이드 적용) */}
      <div className="my-2.5 p-3.5 bg-slate-900 border border-slate-850 rounded-2xl flex items-center gap-3 text-slate-400 flex-shrink-0">
        <Keyboard className="size-4 text-orange-500 flex-shrink-0" />
        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[10px] font-mono font-semibold">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded shadow-sm text-slate-200">Space</kbd>
            <span>{t('kds.shortcuts.refresh')}</span>
          </span>
          <span className="text-slate-800">|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded shadow-sm text-slate-200">1/2/3</kbd>
            <span>{t('kds.shortcuts.filter')}</span>
          </span>
          <span className="text-slate-800">|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded shadow-sm text-slate-200">Q</kbd>
            <span>{t('kds.shortcuts.mute')}</span>
          </span>
          <span className="text-slate-800">|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded shadow-sm text-slate-200">P</kbd>
            <span>{t('kds.shortcuts.oldest_pending')}</span>
          </span>
          <span className="text-slate-800">|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded shadow-sm text-slate-200">R</kbd>
            <span>{t('kds.shortcuts.oldest_preparing')}</span>
          </span>
          <span className="text-slate-800">|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded shadow-sm text-slate-200">C</kbd>
            <span>{t('kds.shortcuts.oldest_ready')}</span>
          </span>
        </div>
      </div>

      {/* 쇼케이스 및 타 대시보드로 돌아가기 링크바 */}
      <footer className="mt-2 pt-3 border-t border-slate-900 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>&copy; WeMarket Store Display.</span>
          <span className="text-slate-700">|</span>
          <Link to={`/admin/stores/${storeId}/foodtruck`} className="hover:text-slate-300 underline">
            {t('kds.footer.mobile_console')}
          </Link>
          <span className="text-slate-700">|</span>
          <Link to={`/admin/stores/${storeId}/foodtruck/analytics`} className="hover:text-slate-300 underline">
            {t('kds.footer.peak_dashboard')}
          </Link>
        </div>
        <div className="font-mono">
          SYSTEM HEALTHY
        </div>
      </footer>
    </div>
  );
}
