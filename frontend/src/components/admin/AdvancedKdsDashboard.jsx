import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Play, CheckCircle2, RefreshCw, Printer, Volume2, VolumeX, 
  Wifi, WifiOff, Clock, User, ChevronRight, Hash, XCircle
} from 'lucide-react';
import{ connectKitchen, getSocket } from '../../utils/socket';
import notificationSound, { vibrateShort, vibrateOrderReady } from '../../utils/notificationSound';

export default function AdvancedKdsDashboard() {
  const { storeId } = useParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilteredType] = useState('ALL'); // ALL, DINE_IN, TAKEOUT
  const [socketStatus, setSocketStatus] = useState('DISCONNECTED');
  const [updatingId, setUpdatingId] = useState(null);

  // 개별 주문의 조리 체크 아이템 상태 관리 (KDS 작업자들이 항목 클릭 시 완료선 긋기 용도)
  const [checkedItems, setCheckedItems] = useState({}); // { [order_id + '-' + item_id]: boolean }

  const timerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

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
      if (!res.ok) throw new Error('KDS 활성 주문 목록을 조회하지 못했습니다.');
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

  // 주문 상태 업데이트 핸들러
  const handleUpdateStatus = async (orderId, nextStatus) => {
    try {
      setUpdatingId(orderId);
      const res = await fetch(`/api/v1/kds/stores/${storeId}/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) throw new Error('주문 상태 변경 요청이 실패했습니다.');
      
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
      // 'preparing' 상태로 서버에 재토글하여 슬립 등록 유도
      const res = await fetch(`/api/v1/kds/stores/${storeId}/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'preparing' })
      });
      if (!res.ok) throw new Error('인쇄 작업 대기열 재등록에 실패했습니다.');
      alert('주방 프린터 출력 작업이 인쇄 대기열에 성공적으로 등록되었습니다.');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 flex flex-col h-screen select-none">
      {/* KDS 최상단 상단바 헤더 */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 text-white p-2 rounded-lg">
            <Printer className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight">
              주방 주문 모니터
              <span className="text-xs font-mono font-normal text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Advanced KDS v1.2
              </span>
            </h1>
            <p className="text-xs text-slate-400">매장 내 조리 대기열 및 영수증 인쇄 연동 컨트롤러</p>
          </div>
        </div>

        {/* 상단 컨트롤 패널 */}
        <div className="flex items-center gap-2">
          {/* 소켓 연결 표시등 */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border ${
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

          {/* 사운드 활성 토글 */}
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-all ${
              soundEnabled 
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' 
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            <span className="font-mono text-xs uppercase">{soundEnabled ? 'ON' : 'MUTED'}</span>
          </button>

          {/* 수동 리프레시 버튼 */}
          <button 
            onClick={() => fetchKdsOrders(true)}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* 필터 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-3 my-3">
        {/* 포장/매장 필터 칩 */}
        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          {[
            { id: 'ALL', label: '전체 주문' },
            { id: 'DINE_IN', label: '매장 식사' },
            { id: 'TAKEOUT', label: '포장 주문' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilteredType(opt.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterType === opt.id 
                  ? 'bg-orange-500 text-white shadow-sm' 
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
            placeholder="주문 번호, 테이블, 고객명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500 placeholder-slate-500 transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300"
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
            <div className="p-3 bg-slate-900/50 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-xs font-bold text-amber-400 tracking-wider flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                접수 대기 (PENDING)
              </h2>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400">
                {pendingOrders.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
              {pendingOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-content justify-center text-center text-slate-600 py-10">
                  <Clock className="size-8 stroke-[1.5] mb-2 opacity-50" />
                  <p className="text-xs">대기 중인 신규 주문이 없습니다.</p>
                </div>
              ) : (
                pendingOrders.map(order => (
                  <div 
                    key={order.id} 
                    className="bg-slate-900 border border-amber-500/20 hover:border-amber-500/40 rounded-lg overflow-hidden transition-all shadow-sm"
                  >
                    <div className="p-3 border-b border-slate-850/60 bg-amber-500/[0.02] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-100">
                          #{order.order_number.slice(-4)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          order.is_takeout ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {order.is_takeout ? '포장' : `${order.table_name || '매장'}번`}
                        </span>
                      </div>
                      <div className={`px-2 py-0.5 text-xs font-mono font-bold rounded-md border ${getTimerSeverityClass(order.created_at)}`}>
                        {formatElapsedTime(order.created_at)}
                      </div>
                    </div>

                    {/* 주문 내역 */}
                    <div className="p-3 flex flex-col gap-2">
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
                        <div className="text-[10px] bg-slate-950 p-2 rounded text-slate-400 border border-slate-900 leading-relaxed">
                          <strong className="text-amber-500">요청사항:</strong> {order.notes}
                        </div>
                      )}

                      {/* 액션 버튼 */}
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'preparing')}
                        disabled={updatingId === order.id}
                        className="w-full mt-2 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Play className="size-3.5 fill-current" />
                        주문 접수 & 조리 시작
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 컬럼 2: 조리 중 (PREPARING) */}
          <div className="bg-slate-900/30 rounded-xl border border-slate-900 flex flex-col min-h-0">
            <div className="p-3 bg-slate-900/50 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-xs font-bold text-sky-400 tracking-wider flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                조리 중 (PREPARING)
              </h2>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400">
                {preparingOrders.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
              {preparingOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-content justify-center text-center text-slate-600 py-10">
                  <Printer className="size-8 stroke-[1.5] mb-2 opacity-50" />
                  <p className="text-xs">조리 중인 주문이 없습니다.</p>
                </div>
              ) : (
                preparingOrders.map(order => (
                  <div 
                    key={order.id} 
                    className="bg-slate-900 border border-sky-500/20 hover:border-sky-500/40 rounded-lg overflow-hidden transition-all shadow-sm"
                  >
                    <div className="p-3 border-b border-slate-850/60 bg-sky-500/[0.02] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-100">
                          #{order.order_number.slice(-4)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          order.is_takeout ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {order.is_takeout ? '포장' : `${order.table_name || '매장'}번`}
                        </span>
                      </div>
                      <div className={`px-2 py-0.5 text-xs font-mono font-bold rounded-md border ${getTimerSeverityClass(order.created_at)}`}>
                        {formatElapsedTime(order.created_at)}
                      </div>
                    </div>

                    {/* 인터랙티브 체크아이템 주문 상품 목록 */}
                    <div className="p-3 flex flex-col gap-2">
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
                        <div className="text-[10px] bg-slate-950 p-2 rounded text-slate-400 border border-slate-900 leading-relaxed">
                          <strong className="text-sky-500">요청사항:</strong> {order.notes}
                        </div>
                      )}

                      {/* 슬립 인쇄 대기열 강제 재등록 단추 */}
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() => handleReprintSlip(order.id)}
                          disabled={updatingId === order.id}
                          title="주방 인쇄 작업 강제 추가"
                          className="px-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-750 disabled:opacity-50 text-slate-400 hover:text-slate-200 rounded font-medium text-xs flex items-center justify-center transition-all"
                        >
                          <Printer className="size-3.5" />
                        </button>
                        
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'ready')}
                          disabled={updatingId === order.id}
                          className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-slate-950 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <CheckCircle2 className="size-3.5" />
                          조리 완료 (CALL)
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 컬럼 3: 수령 대기 (READY) */}
          <div className="bg-slate-900/30 rounded-xl border border-slate-900 flex flex-col min-h-0">
            <div className="p-3 bg-slate-900/50 border-b border-slate-850 flex items-center justify-between">
              <h2 className="text-xs font-bold text-emerald-400 tracking-wider flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                수령 대기 (READY)
              </h2>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">
                {readyOrders.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
              {readyOrders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-content justify-center text-center text-slate-600 py-10">
                  <CheckCircle2 className="size-8 stroke-[1.5] mb-2 opacity-50" />
                  <p className="text-xs">호출 대기 중인 완료 메뉴가 없습니다.</p>
                </div>
              ) : (
                readyOrders.map(order => (
                  <div 
                    key={order.id} 
                    className="bg-slate-900 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg overflow-hidden transition-all shadow-sm"
                  >
                    <div className="p-3 border-b border-slate-850/60 bg-emerald-500/[0.02] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-100">
                          #{order.order_number.slice(-4)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          order.is_takeout ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {order.is_takeout ? '포장' : `${order.table_name || '매장'}번`}
                        </span>
                      </div>
                      <div className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded font-mono font-bold">
                        CALLING...
                      </div>
                    </div>

                    {/* 수령 정보 카드 */}
                    <div className="p-3 flex flex-col gap-2">
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850/60 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <User className="size-3.5" />
                          <span>고객 연락처:</span>
                          <span className="font-mono text-slate-200">
                            {order.customer_phone ? '010-****-' + order.customer_phone.slice(-4) : '등록 정보 없음'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Hash className="size-3.5" />
                          <span>대기순서:</span>
                          <span className="font-mono text-slate-200">
                            {order.queue_number ? `${order.queue_number}번` : '정보 없음'}
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

                      {/* 액션 버튼 */}
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'completed')}
                        disabled={updatingId === order.id}
                        className="w-full mt-2 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 className="size-3.5" />
                        음식 수령 완료
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 쇼케이스 및 타 대시보드로 돌아가기 링크바 */}
      <footer className="mt-3 pt-3 border-t border-slate-900 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>&copy; WeMarket Store Display.</span>
          <span className="text-slate-700">|</span>
          <Link to={`/admin/stores/${storeId}/foodtruck`} className="hover:text-slate-300 underline">
            모바일 점주 콘솔
          </Link>
          <span className="text-slate-700">|</span>
          <Link to={`/admin/stores/${storeId}/foodtruck/analytics`} className="hover:text-slate-300 underline">
            지능형 피크분석 대시보드
          </Link>
        </div>
        <div className="font-mono">
          SYSTEM HEALTHY
        </div>
      </footer>
    </div>
  );
}
