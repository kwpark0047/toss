import { useState, useRef, useCallback, useEffect } from 'react';
import { adminAPI } from '../../api/admin';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../ui/Icon';

/**
 * StoreEnrichment — 네이버 지역검색 API로 매장 좌표·전화·업종을 보강하는
 * super_admin 전용 배치 도구. 커서 기반으로 "조금씩" 진행하며, 진행률·로그 표시.
 * 메뉴·사진·리뷰는 업주 셀프등록 영역(API 미제공)이라 대상 아님.
 */
export default function StoreEnrichment() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [totals, setTotals] = useState({ processed: 0, matched: 0, updated: 0 });
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const stopRef = useRef(false);

  // 보강 공급자 설정 상태 (미설정 공급자는 버튼 비활성화 + 누락 환경변수 안내)
  const [providerStatus, setProviderStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    adminAPI.enrichmentStatus()
      .then(res => { if (!cancelled) setProviderStatus(res?.data?.providers || res?.providers || null); })
      .catch(() => { if (!cancelled) setProviderStatus(null); });
    return () => { cancelled = true; };
  }, []);

  const naverConfigured = providerStatus?.naver?.configured !== false;
  const seoulConfigured = providerStatus?.seoul?.configured !== false;
  const geocodeConfigured = providerStatus?.geocoding?.configured !== false;
  const geocodeProvider = providerStatus?.geocoding?.availableProviders?.[0];

  const addLog = (msg, type = 'info') => setLogs(l => [{ msg, type, t: Date.now() }, ...l].slice(0, 100));

  const runLoop = useCallback(async () => {
    stopRef.current = false;
    setRunning(true);
    setError('');
    let after = cursor;
    try {
      // 한 번에 10건씩, 완료(done)까지 반복. 각 배치 사이 짧은 텀.
      // 사용자가 중지하면 즉시 종료.
      while (!stopRef.current) {
        const res = await adminAPI.enrichStores({ limit: 10, afterId: after });
        const d = res?.data || res;
        after = d.nextCursor ?? after;
        setCursor(after);
        setTotals(t => ({
          processed: t.processed + (d.processed || 0),
          matched: t.matched + (d.matched || 0),
          updated: t.updated + (d.updated || 0),
        }));
        (d.results || []).forEach(r => {
          if (r.patch) addLog(`✓ ${r.name} — ${Object.keys(r.patch).join(', ')} 보강`, 'ok');
          else if (r.error) addLog(`⚠ ${r.name} — ${r.error}`, 'warn');
          else addLog(`· ${r.name} — 매칭 없음`, 'muted');
        });
        if (d.done) { addLog('모든 대상 매장 처리 완료 🎉', 'ok'); break; }
        await new Promise(r => setTimeout(r, 600)); // 배치 간 텀(폭주 방지)
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 503) setError('네이버 API 키(NAVER_CLIENT_SECRET)가 서버에 설정되지 않았습니다. Render 환경변수에 추가 후 다시 시도하세요.');
      else if (status === 403) setError('최고관리자만 사용할 수 있습니다.');
      else setError(e?.response?.data?.error || e.message || '오류가 발생했습니다.');
    } finally {
      setRunning(false);
    }
  }, [cursor]);

  // 서울 열린데이터(LOCALDATA) 보강 루프 — 커서=start 인덱스
  const seoulCursor = useRef(1);
  const runSeoul = useCallback(async () => {
    stopRef.current = false;
    setRunning(true);
    setError('');
    try {
      while (!stopRef.current) {
        const res = await adminAPI.enrichSeoul({ start: seoulCursor.current, size: 300 });
        const d = res?.data || res;
        seoulCursor.current = d.nextStart ?? seoulCursor.current;
        setCursor(seoulCursor.current);
        setTotals(t => ({
          processed: t.processed + (d.processed || 0),
          matched: t.matched + (d.matched || 0),
          updated: t.updated + (d.updated || 0),
        }));
        addLog(`[서울 ${d.nextStart - d.processed}~] 처리 ${d.processed} · 매칭 ${d.matched} · 보강 ${d.updated}${d.nameFixed ? ` · 이름교정 ${d.nameFixed}` : ''}`, d.updated ? 'ok' : 'muted');
        (d.samples || []).forEach(s => addLog(`  ✓ ${s.was} → ${Object.keys(s.patch).join(', ')}`, 'ok'));
        if (d.done) { addLog('서울 데이터 전체 스캔 완료 🎉', 'ok'); break; }
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 503) setError('서울 API 키(SEOUL_OPENAPI_KEYS)가 서버에 설정되지 않았습니다.');
      else if (status === 403) setError('최고관리자만 사용할 수 있습니다.');
      else setError(e?.response?.data?.error || e.message || '오류가 발생했습니다.');
    } finally {
      setRunning(false);
    }
  }, []);

  // 주소→좌표 지오코딩 루프 (좌표 없는 매장, 커서=afterId)
  const geoCursor = useRef(0);
  const runGeocode = useCallback(async () => {
    stopRef.current = false;
    setRunning(true);
    setError('');
    try {
      while (!stopRef.current) {
        const res = await adminAPI.geocodeStores({ limit: 20, afterId: geoCursor.current });
        const d = res?.data || res;
        geoCursor.current = d.nextCursor ?? geoCursor.current;
        setCursor(geoCursor.current);
        setTotals(t => ({
          processed: t.processed + (d.processed || 0),
          matched: t.matched + (d.geocoded || 0),
          updated: t.updated + (d.geocoded || 0),
        }));
        addLog(`[지오코딩 ${d.provider}] 처리 ${d.processed} · 좌표 ${d.geocoded} · 실패 ${d.failed}`, d.geocoded ? 'ok' : 'muted');
        (d.samples || []).forEach(s => addLog(`  📍 ${s.name} → ${s.lat}, ${s.lng}`, 'ok'));
        if (d.done) { addLog('좌표 없는 매장 지오코딩 완료 🎉', 'ok'); break; }
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 503) setError('지오코딩 키(KAKAO_REST_API_KEY 또는 NCP)가 서버에 설정되지 않았습니다.');
      else if (status === 403) setError('최고관리자만 사용할 수 있습니다.');
      else setError(e?.response?.data?.error || e.message || '오류가 발생했습니다.');
    } finally {
      setRunning(false);
    }
  }, []);

  const stop = () => { stopRef.current = true; };

  if (user && user.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <p className="font-bold">최고관리자 전용 기능입니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-20 text-white">
      <header className="flex items-center gap-4 pt-2 pb-6 border-b border-white/10">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/15 flex items-center justify-center">
          <Icon icon="MapPin" />
        </div>
        <div>
          <h1 className="text-2xl font-black">매장 정보 보강</h1>
          <p className="text-xs text-slate-500 font-bold mt-0.5">네이버 지역검색 API · 좌표·전화·업종 자동 채움 (공식 API, 요청 한도 준수)</p>
        </div>
      </header>

      {/* 안내 */}
      <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[11px] text-slate-400 leading-snug">
        상호명·주소 기준 <b className="text-slate-200 font-bold">좌표·전화번호·업종</b>을 공식 API로 조회해 <b className="text-slate-200 font-bold">빈 항목만</b> 채웁니다. 커서 기반으로 조금씩 진행하며 언제든 중지할 수 있어요.
        <span className="block mt-1 text-[10px] text-slate-500">※ 메뉴·사진·리뷰는 저작권상 자동 수집하지 않으며, 업주 셀프등록으로 채워집니다.</span>
      </div>

      {/* 진행 통계 */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        {[
          { label: '처리', value: totals.processed },
          { label: '매칭', value: totals.matched },
          { label: '보강', value: totals.updated },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black tabular-nums">{s.value}</p>
            <p className="text-[11px] text-slate-500 font-bold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 mt-2 text-center">현재 커서(마지막 매장 ID): <span className="tabular-nums text-slate-300">{cursor}</span></p>

      {/* 컨트롤 */}
      <div className="flex flex-col sm:flex-row gap-2 mt-5">
        {!running ? (
          <>
            <button type="button" onClick={runLoop} disabled={!naverConfigured}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 text-white font-black shadow-lg shadow-orange-500/20 hover:brightness-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100">
              <Play size={18} aria-hidden="true" /> 네이버 보강 시작
            </button>
            <button type="button" onClick={runSeoul} disabled={!seoulConfigured}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-white/5 border border-white/15 text-white font-black hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5">
              <Play size={18} aria-hidden="true" /> 서울 데이터 보강
            </button>
            <button type="button" onClick={runGeocode} disabled={!geocodeConfigured}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black hover:bg-emerald-500/25 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/15">
              <Icon icon="MapPin" /> 주소→좌표 지오코딩
            </button>
          </>
        ) : (
          <button type="button" onClick={stop}
            className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-white/10 text-white font-black hover:bg-white/15 transition-all">
            <Square size={16} aria-hidden="true" /> 중지
          </button>
        )}
      </div>

      {/* 공급자 설정 상태 */}
      {providerStatus && (
        <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-3.5 text-[11px] space-y-1.5">
          <p className="text-slate-400 font-black uppercase tracking-wider text-[10px]">공급자 설정 상태</p>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${naverConfigured ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="font-bold text-slate-300">네이버</span>
            {providerStatus.naver?.missing?.length > 0
              ? providerStatus.naver.missing.map(key => (
                  <span key={key}>
                    <span className="text-rose-300 font-mono">{key}</span>
                    <span className="text-rose-300/70"> 미설정</span>
                  </span>
                ))
              : <span className="text-slate-500">설정됨</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${seoulConfigured ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="font-bold text-slate-300">서울 열린데이터</span>
            {providerStatus.seoul?.configured
              ? <span className="text-slate-500">키 {providerStatus.seoul.keyCount}개 설정됨</span>
              : <span className="text-rose-300 font-mono">SEOUL_OPENAPI_KEYS 미설정</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${geocodeConfigured ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="font-bold text-slate-300">주소→좌표</span>
            {geocodeConfigured
              ? <span className="text-slate-500">사용: {geocodeProvider}</span>
              : <span className="text-rose-300 font-mono">지오코딩 키 미설정</span>}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-sm text-rose-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" /> {error}
        </div>
      )}

      {/* 로그 */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-2">
          {running && <Loader2 size={14} className="animate-spin text-orange-400" aria-hidden="true" />}
          <h2 className="text-sm font-black">처리 로그</h2>
        </div>
        <div className="bg-black/30 border border-white/10 rounded-2xl p-4 max-h-80 overflow-y-auto space-y-1 font-mono text-[12px]">
          {logs.length === 0 ? (
            <p className="text-slate-600">시작하면 처리 결과가 여기에 표시됩니다.</p>
          ) : logs.map((l, i) => (
            <p key={i} className={
              l.type === 'ok' ? 'text-emerald-400' : l.type === 'warn' ? 'text-amber-400' : l.type === 'muted' ? 'text-slate-500' : 'text-slate-300'
            }>{l.msg}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
