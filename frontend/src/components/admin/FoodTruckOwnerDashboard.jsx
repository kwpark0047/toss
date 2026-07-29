import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { 
  MapPin, ShieldAlert, Sparkles, Navigation, CheckCircle2, 
  RefreshCw, Power, AlertTriangle, Play, HelpCircle
} from 'lucide-react';

export default function FoodTruckOwnerDashboard() {
  const { storeId } = useParams();
  const [truckInfo, setTruckInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingGps, setSyncingGps] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualCoords, setManualCoords] = useState({ lat: 37.5562, lng: 126.9224 }); // 기본 홍대입구
  const [_gpsError, setGpsError] = useState(null);

  const _watchIdRef = useRef(null);
  const syncIntervalRef = useRef(null);

  // 푸드트럭 메타 데이터 상세 조회
  const fetchTruckDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/foodtruck/stores/${storeId}`);
      if (!res.ok) throw new Error('푸드트럭 메타 정보를 조회하지 못했습니다.');
      const json = await res.json();
      const data = json.data || json;
      if (data) {
        setTruckInfo(data);
        setManualAddress(data.geocoded_address || '');
        setManualCoords({ lat: data.latitude, lng: data.longitude });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchTruckDetails();
    }
    return () => {
      stopAutoSync();
    };
  }, [storeId]);

  // 영업 세션 토글 API 호출
  const handleToggleSession = async () => {
    if (!truckInfo) return;
    const nextState = !truckInfo.is_active_session;
    try {
      const res = await fetch(`/api/v1/foodtruck/stores/${storeId}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active_session: nextState })
      });
      if (!res.ok) throw new Error('세션 변경 요청이 실패했습니다.');
      const json = await res.json();
      const updated = json.data || json;
      setTruckInfo(prev => ({ ...prev, is_active_session: updated.is_active_session }));
    } catch (err) {
      alert(err.message);
    }
  };

  // 긴급 전체 품절 킬스위치 API 호출
  const handleToggleEmergencySoldOut = async () => {
    if (!truckInfo) return;
    const nextState = !truckInfo.is_sold_out_emergency;
    
    const confirmMessage = nextState
      ? '🚨 [경고] 정말 비상 품절 처리하시겠습니까? 활성화 즉시 매장 안의 모든 상품이 일제히 품절(Out of stock) 상태로 강제 전환되어 오프라인 결제가 전면 정지됩니다.'
      : '점포 정상 영업 상태로 복구하시겠습니까?';
      
    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await fetch(`/api/v1/foodtruck/stores/${storeId}/emergency-soldout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_sold_out_emergency: nextState })
      });
      if (!res.ok) throw new Error('품절 전환 요청이 실패했습니다.');
      const json = await res.json();
      const updated = json.data || json;
      setTruckInfo(prev => ({ ...prev, is_sold_out_emergency: updated.is_sold_out_emergency }));
    } catch (err) {
      alert(err.message);
    }
  };

  // 단일 수동 GPS 갱신 업데이트
  const handleUpdateGpsManually = async (lat, lng, label) => {
    try {
      setSyncingGps(true);
      const res = await fetch(`/api/v1/foodtruck/stores/${storeId}/gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          geocoded_address: label || manualAddress
        })
      });
      if (!res.ok) throw new Error('위치 동기화에 실패했습니다.');
      const json = await res.json();
      const updated = json.data || json;
      setTruckInfo(prev => ({ 
        ...prev, 
        latitude: updated.latitude, 
        longitude: updated.longitude,
        geocoded_address: updated.geocoded_address 
      }));
      setManualAddress(updated.geocoded_address);
      setManualCoords({ lat: updated.latitude, lng: updated.longitude });
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingGps(false);
    }
  };

  // 실시간 기기 GPS 워칭 동기화 온/오프
  const toggleAutoSync = () => {
    if (autoSync) {
      stopAutoSync();
    } else {
      startAutoSync();
    }
  };

  const startAutoSync = () => {
    if (!navigator.geolocation) {
      alert('이 브라우저는 위치 기반 추적기를 완벽히 지원하지 않습니다.');
      return;
    }
    setAutoSync(true);
    setGpsError(null);

    // 최초 1회 즉시 실행
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleUpdateGpsManually(pos.coords.latitude, pos.coords.longitude);
      },
      (_err) => {
        setGpsError('현재 디바이스의 하드웨어 GPS 칩셋 응답이 없습니다.');
      }
    );

    // 30초 간격 브라우저 GPS 주기 추적 루프 가동
    syncIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleUpdateGpsManually(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('Interval GPS refresh skipped: ', err.message);
        }
      );
    }, 30000);
  };

  const stopAutoSync = () => {
    setAutoSync(false);
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  };

  const handleSpotSelect = (lat, lng, spotName) => {
    handleUpdateGpsManually(lat, lng, spotName);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px] text-slate-400">
        <RefreshCw className="animate-spin text-orange-500 mb-3" size={32} />
        <p className="font-bold text-sm">푸드트럭 패널 정보를 로드하고 있습니다...</p>
      </div>
    );
  }

  const isSessionOn = truckInfo?.is_active_session;
  const isSoldOutOn = truckInfo?.is_sold_out_emergency;

  return (
    <div className="space-y-8 text-slate-100 max-w-4xl mx-auto">
      
      {/* 1. 최상단 긴급 헤더 및 경고 슬라이더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-slate-850 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_100%_0%,rgba(249,115,22,0.05),transparent_70%)] pointer-events-none" />
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            <h2 className="text-lg font-black text-white">푸드트럭 필드 콘솔</h2>
          </div>
          <p className="text-xs text-slate-400 font-semibold">
            이동형 트럭 영업 현장의 실시간 위치 발송, 영업 세션 개시 및 품절 비상정지를 제어합니다.
          </p>
        </div>

        {/* 현재 상태 정보 퀵 패널 */}
        <div className="flex gap-2">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
            isSessionOn 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {isSessionOn ? '영업 중' : '영업 마감'}
          </span>
          <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
            isSoldOutOn 
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {isSoldOutOn ? '🚨 긴급품절 활성' : '정상 재고'}
          </span>
        </div>
      </div>

      {/* 2. 영업 세션 및 긴급 품절 토글 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 영업 세션 제어 카드 */}
        <div className={`p-6 rounded-3xl border transition-all flex flex-col justify-between h-56 ${
          isSessionOn 
            ? 'bg-slate-900/60 border-emerald-500/30' 
            : 'bg-slate-900/20 border-slate-900'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">영업 개시 / 마감</span>
              <Power className={isSessionOn ? 'text-emerald-500 animate-pulse' : 'text-slate-650'} size={20} />
            </div>
            <h3 className="text-base font-black text-white mt-4">
              {isSessionOn ? '현재 고객 주문을 접수하고 있습니다' : '영업이 마감된 상태입니다'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-semibold leading-relaxed">
              영업을 개시하면 실시간 지도상에 가게가 "영업중" 상태로 정식 노출되며 손님들이 스마트 메뉴판에 진입해 바로 결제할 수 있게 됩니다.
            </p>
          </div>

          <button
            onClick={handleToggleSession}
            className={`w-full py-3.5 rounded-2xl text-xs font-black transition-all active:scale-95 ${
              isSessionOn 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/10'
            }`}
          >
            {isSessionOn ? '영업 일시 중지 / 마감하기' : '지금 즉시 영업 개시 (Open)'}
          </button>
        </div>

        {/* 긴급 품절 킬스위치 카드 */}
        <div className={`p-6 rounded-3xl border transition-all flex flex-col justify-between h-56 ${
          isSoldOutOn 
            ? 'bg-rose-950/20 border-rose-500/50' 
            : 'bg-slate-900/20 border-slate-900'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Sold-Out Emergency</span>
              <ShieldAlert className={isSoldOutOn ? 'text-rose-500 animate-bounce' : 'text-slate-650'} size={20} />
            </div>
            <h3 className="text-base font-black text-white mt-4">
              재료 완전 소진 킬스위치 (Kill Switch)
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-semibold leading-relaxed">
              러시 아워에 예기치 않게 전 주재료가 소진되는 비상 상황 발생 시, 한 번의 탭으로 매장 내 모든 제품들을 품절 처리하여 신규 진입 오주문을 차단합니다.
            </p>
          </div>

          <button
            onClick={handleToggleEmergencySoldOut}
            className={`w-full py-3.5 rounded-2xl text-xs font-black transition-all active:scale-95 ${
              isSoldOutOn 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                : 'bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white shadow-xl shadow-orange-500/10'
            }`}
          >
            {isSoldOutOn ? '정상 메뉴 영업으로 환원하기' : '🚨 긴급 전체 메뉴 품절시키기'}
          </button>
        </div>

      </div>

      {/* 3. 위치 정보 & 자동 GPS 싱크 조절기 */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-850 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white">현장 실시간 위경도 GPS 동기화</h3>
            <p className="text-xs text-slate-400 font-semibold">
              점포 이동 시 실시간 위경도 신호를 감지하여 도로명 주소로 역매핑 전파합니다.
            </p>
          </div>

          {/* 자동 업데이트 활성 스위치 (최소 44px 모바일 터치 타겟 규격 준수 고도화) */}
          <button
            onClick={toggleAutoSync}
            className={`flex items-center justify-center gap-2 px-6 h-12 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
              autoSync 
                ? 'bg-orange-500/15 text-orange-500 border-orange-500/30' 
                : 'bg-slate-950/40 text-slate-400 border-slate-800'
            }`}
          >
            <Navigation size={12} className={autoSync ? 'animate-spin' : ''} />
            {autoSync ? '실시간 30초 추적기 켜짐' : '실시간 자동 추적 켜기'}
          </button>
        </div>

        {/* 실시간 감지 상태 요약 패널 */}
        <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-850/60 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">현재 한글 주소</span>
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-orange-500 shrink-0" />
              <span className="text-xs font-black text-white truncate">
                {truckInfo?.geocoded_address || '파악되지 않음'}
              </span>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">위경도 좌표 (LAT / LNG)</span>
            <code className="text-xs font-mono text-orange-400 font-bold block mt-0.5">
              {truckInfo?.latitude?.toFixed(6) || '0.000000'}, {truckInfo?.longitude?.toFixed(6) || '0.000000'}
            </code>
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">동기화 엔진 상태</span>
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1 mt-0.5">
              {autoSync ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                  정상 기기 추적 가동 중 (30s)
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-650" />
                  수동 / 고정 모드 작동 중
                </>
              )}
            </span>
          </div>
        </div>

        {/* 4. 긴급 상권 거점 수동 이동 원클릭 셀렉터 */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="text-orange-500" size={14} />
            <span className="text-xs font-black text-white">동선 핫스팟 퀵 이동 원클릭 (수동 핀보정)</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
            GPS 전파 차단 지하층, 빌딩 숲 상권의 위성 반사 오류로 좌표 왜곡 발생 시 가동할 수 있는 핫스팟 원클릭 주소 고정 패널입니다.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              onClick={() => handleSpotSelect(37.5562, 126.9224, '홍대 걷고싶은거리')}
              className="px-5 h-11 rounded-xl bg-slate-950/30 border border-slate-800 text-xs font-bold hover:border-orange-500/40 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center justify-center"
            >
              🚩 홍대입구
            </button>
            <button
              onClick={() => handleSpotSelect(37.4979, 127.0276, '강남역 11번 출구 스퀘어')}
              className="px-5 h-11 rounded-xl bg-slate-950/30 border border-slate-800 text-xs font-bold hover:border-orange-500/40 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center justify-center"
            >
              🚩 강남역 사거리
            </button>
            <button
              onClick={() => handleSpotSelect(37.5822, 127.0018, '대학로 마로니에 예술공원')}
              className="px-5 h-11 rounded-xl bg-slate-950/30 border border-slate-800 text-xs font-bold hover:border-orange-500/40 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center justify-center"
            >
              🚩 대학로
            </button>
            <button
              onClick={() => handleSpotSelect(35.1585, 129.0620, '부산 서면 쥬디스태화 스퀘어')}
              className="px-5 h-11 rounded-xl bg-slate-950/30 border border-slate-800 text-xs font-bold hover:border-orange-500/40 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center justify-center"
            >
              🚩 부산 서면
            </button>
          </div>
        </div>

        {/* 5. 수동 정밀 커스텀 좌표 입력 폼 */}
        <div className="pt-3 border-t border-slate-850/60 space-y-4">
          <span className="text-xs font-black text-slate-300 block">기타 동선 도로명 주소 커스텀 입력</span>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="예: 여의도 한강시민공원 멀티플라자 광장 앞"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-500 text-xs font-bold focus:outline-none focus:border-orange-500/40 focus:ring-4 focus:ring-orange-500/5 transition-all"
            />
            <button
              onClick={() => handleUpdateGpsManually(manualCoords.lat, manualCoords.lng)}
              disabled={syncingGps}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              {syncingGps ? (
                <>
                  <RefreshCw className="animate-spin" size={12} />
                  위치 반영 중...
                </>
              ) : (
                '주소 지정 전송'
              )}
            </button>
          </div>
        </div>

      </div>

      {/* 6. 운영 실시간 가이드 및 주의사항 공지 */}
      <div className="p-6 rounded-3xl bg-orange-500/5 border border-orange-500/10 flex items-start gap-4">
        <AlertTriangle className="text-orange-500 shrink-0 mt-0.5 animate-pulse" size={18} />
        <div className="space-y-1">
          <h4 className="text-xs font-black text-white">푸드트럭 안전 현장 운영 원칙</h4>
          <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
            1. 점포 이동 시 손님들이 허위 위치를 찾아가지 않도록 즉시 <strong>실시간 위치 동기화</strong> 버튼을 누르거나 핫스팟 수동 주소를 발행해 주세요.<br />
            2. 무선 인터넷 감도가 유동적으로 요동치는 지하 또는 실내 공간에서는 30초 추적기 대신 <strong>주소 고정 전송</strong>을 사용하여 동선을 올바르게 지정하는 것이 손실을 막는 최선의 방법입니다.<br />
            3. 재료 소진으로 더 이상의 주문 대기열 접수가 불가할 경우, 반드시 <strong>'긴급 전체 메뉴 품절' 킬스위치</strong>를 활성화해 오주문을 방지하십시오.
          </p>
        </div>
      </div>

    </div>
  );
}
