import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import { campaignAPI } from '@/api/admin';
import Skeleton from '@/components/common/Skeleton';
import EmptyState from '@/components/common/EmptyState';
import Icon from '../../components/ui/Icon';

/* ── 유형별 메타 ─────────────────────────────────────────────── */
const TRIGGER_META = {
  WELCOME: {
    label: '첫 방문 환영',
    icon: 'Gift',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50'
  },
  TIER_UP: {
    label: '등급 승급',
    icon: 'TrendingUp',
    color: 'text-purple-600',
    bg: 'bg-purple-50'
  },
  BIRTHDAY: {
    label: '생일 축하',
    icon: 'Gift',
    color: 'text-rose-600',
    bg: 'bg-rose-50'
  },
  LAPSED: {
    label: '재방문 유도',
    icon: Target,
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  },
  MANUAL: {
    label: '수동 발송',
    icon: Megaphone,
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  }
};
const TIER_LABELS = {
  GENERAL: '일반',
  SILVER: '실버',
  GOLD: '골드',
  VIP: 'VIP',
  PLATINUM: '플래티넘'
};
const statusClass = active => active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500';

/* ── RFM 세그먼트 분석 결과 타입 ───────────────────────────── */
const SEGMENT_INFO = {
  Champions: {
    label: '최우수 고객',
    color: 'text-purple-700 bg-purple-100',
    score: 5
  },
  Loyal: {
    label: '충성 고객',
    color: 'text-blue-700 bg-blue-100',
    score: 4
  },
  At_Risk: {
    label: '이탈 위험',
    color: 'text-orange-700 bg-orange-100',
    score: 2
  },
  Lost: {
    label: '이탈 고객',
    color: 'text-red-700 bg-red-100',
    score: 1
  },
  New: {
    label: '신규 고객',
    color: 'text-green-700 bg-green-100',
    score: 3
  },
  General: {
    label: '일반 고객',
    color: 'text-gray-700 bg-gray-100',
    score: 3
  }
};

/* ================================================================
 *  CampaignDashboard
 *  ================================================================
 *  통합 캠페인 관리 + RFM 분석 + AI SMS 발송 + 성과 추적
 * ================================================================ */
export default function CampaignDashboard() {
  const {
    storeId
  } = useParams();
  const [tab, setTab] = useState('campaigns'); // campaigns | analysis | create | automation
  const [campaigns, setCampaigns] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [automationRuns, setAutomationRuns] = useState([]);
  const [automationSegment, setAutomationSegment] = useState('New');
  const [automationMessage, setAutomationMessage] = useState('');
  const [automationLoading, setAutomationLoading] = useState(false);

  // Campaign form
  const [form, setForm] = useState({
    trigger_type: 'WELCOME',
    target_tier: '',
    coupon_id: '',
    is_active: 1
  });
  const showToast = useCallback((msg, type = 'success') => {
    setToast({
      msg,
      type
    });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── 데이터 로드 ───────────────────────────────────────── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sid = storeId;
      const [campRes, coupRes, analysisRes, automationRes] = await Promise.all([
        campaignAPI.getList(sid),
        campaignAPI.getCoupons(sid),
        campaignAPI.getAnalysis(sid).catch(() => null),
        campaignAPI.getAutomationRuns(sid).catch(() => ({ data: [] }))
      ]);
      setCampaigns(campRes?.data || campRes || []);
      setCoupons(coupRes?.data || coupRes || []);
      if (analysisRes?.data) setAnalysis(analysisRes.data);
      setAutomationRuns(automationRes?.data || automationRes || []);
    } catch (_e) {
      setError(_e.response?.data?.error || _e.message);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const generateAutomation = async (segmentName = automationSegment, message = automationMessage) => {
    if (!message.trim()) {
      showToast('발송 메시지를 입력하세요.', 'error');
      return;
    }
    setAutomationLoading(true);
    try {
      await campaignAPI.generateAutomation(storeId, { segmentName, message: message.trim() });
      showToast('승인 대기 캠페인이 생성되었습니다.');
      await loadAll();
    } catch (error) {
      showToast(error.response?.data?.error || '캠페인 후보 생성 실패', 'error');
    } finally {
      setAutomationLoading(false);
    }
  };

  const decideAutomation = async (id, status) => {
    try {
      await campaignAPI.decideAutomation(storeId, id, status);
      showToast(status === 'approved' ? '캠페인을 승인했습니다.' : '캠페인을 거절했습니다.');
      await loadAll();
    } catch (error) {
      showToast(error.response?.data?.error || '캠페인 처리 실패', 'error');
    }
  };

  const sendAutomation = async (id) => {
    if (!confirm('승인된 캠페인을 발송하시겠습니까?')) return;
    try {
      await campaignAPI.sendAutomation(storeId, id);
      showToast('캠페인 발송이 완료되었습니다.');
      await loadAll();
    } catch (error) {
      showToast(error.response?.data?.error || '캠페인 발송 실패', 'error');
    }
  };
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── 캠페인 저장 ───────────────────────────────────────── */
  const handleSave = async () => {
    if (!form.trigger_type) {
      showToast('트리거 유형을 선택하세요.', 'error');
      return;
    }
    if (!form.coupon_id) {
      showToast('쿠폰을 선택하세요.', 'error');
      return;
    }
    if (form.trigger_type === 'TIER_UP' && !form.target_tier) {
      showToast('등급 승급 트리거는 대상 등급이 필요합니다.', 'error');
      return;
    }
    // coupon_id 유효성 검사
    const couponId = parseInt(form.coupon_id, 10);
    if (isNaN(couponId)) {
      showToast('올바른 쿠폰을 선택하세요.', 'error');
      return;
    }
    try {
      const payload = {
        trigger_type: form.trigger_type,
        coupon_id: couponId,
        is_active: form.is_active,
        ...(form.target_tier && { target_tier: form.target_tier })
      };
      await campaignAPI.create(storeId, payload);
      showToast('캠페인이 저장되었습니다.');
      setForm({
        trigger_type: 'WELCOME',
        target_tier: '',
        coupon_id: '',
        is_active: 1
      });
      loadAll();
    } catch (_e) {
      showToast(_e.response?.data?.error || '저장 실패', 'error');
    }
  };

  /* ── 캠페인 토글 / 삭제 ────────────────────────────────── */
  const toggleCampaign = async c => {
    try {
      await campaignAPI.toggle(storeId, c.id, {
        trigger_type: c.trigger_type,
        coupon_id: c.coupon_id,
        target_tier: c.target_tier,
        is_active: c.is_active ? 0 : 1
      });
      loadAll();
    } catch (_e) {
      showToast('상태 변경 실패', 'error');
    }
  };
  const deleteCampaign = async id => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await campaignAPI.delete(storeId, id);
      showToast('삭제되었습니다.');
      loadAll();
    } catch (_e) {
      showToast('삭제 실패', 'error');
    }
  };

  /* ── AI 스마트 SMS 발송 ────────────────────────────────── */
  const sendSmartSms = async segmentName => {
    // 세그먼트 유효성 검사
    const validSegments = ['Champions', 'Loyal', 'At_Risk', 'Lost', 'New', 'General'];
    if (!validSegments.includes(segmentName)) {
      showToast('유효하지 않은 세그먼트입니다.', 'error');
      return;
    }
    setSending(true);
    try {
      const defaults = {
        Champions: '늘 찾아주시는 고객님께 감사 혜택을 준비했습니다.',
        Loyal: '단골 고객님을 위한 특별 혜택을 준비했습니다.',
        At_Risk: '오랜만에 다시 방문해 주세요. 특별 혜택을 드립니다.',
        Lost: '다시 뵙고 싶습니다. 재방문 고객 혜택을 준비했습니다.',
        New: '첫 방문 감사합니다. 다음 방문 혜택을 준비했습니다.',
        General: '새로운 메뉴와 혜택을 확인해 보세요.',
      };
      await generateAutomation(segmentName, defaults[segmentName]);
    } catch (_e) {
      showToast(_e.response?.data?.error || 'SMS 발송 실패', 'error');
    } finally {
      setSending(false);
    }
  };

  /* ── RFM 분석 요약 ─────────────────────────────────────── */
  const segmentData = useMemo(() => {
    if (!analysis?.summary?.segments) return [];
    return Object.entries(analysis.summary.segments).filter(([_, count]) => count > 0).sort((a, b) => (SEGMENT_INFO[b[0]]?.score || 0) - (SEGMENT_INFO[a[0]]?.score || 0));
  }, [analysis]);
  if (loading) return <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>;
  if (error) return <div className="p-6">
      <div className="rounded-2xl bg-red-50 p-6 text-center border border-red-100">
        <Icon icon="AlertTriangle" />
        <p className="text-red-600 font-medium">데이터를 불러오지 못했습니다</p>
        <p className="text-sm text-red-400 mt-1">{error}</p>
        <button onClick={loadAll} className="mt-4 text-sm text-red-600 underline">다시 시도</button>
      </div>
    </div>;
  const totalCustomers = analysis?.summary?.total_customers || 0;
  const avgSpent = analysis?.summary?.avg_spent_per_customer || 0;
  return <div className="p-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium animate-in slide-in-from-right
          ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-900 text-white'}`}>
          {toast.msg}
        </div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Icon icon="Megaphone" /> 스마트 마케팅
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI 기반 고객 세그먼트 분석 + 자동 캠페인</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('campaigns')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'campaigns' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
            캠페인 목록
          </button>
          <button onClick={() => setTab('analysis')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'analysis' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
            고객 분석
          </button>
          <button onClick={() => setTab('automation')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'automation' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
            발송 승인
          </button>
          <button onClick={() => setTab('create')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'create' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
            + 새 캠페인
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><Icon icon="Users" /> 전체 고객</div>
          <p className="text-xl font-bold text-gray-900">{totalCustomers.toLocaleString()}명</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><Icon icon="Megaphone" /> 활성 캠페인</div>
          <p className="text-xl font-bold text-gray-900">{campaigns.filter(c => c.is_active).length}건</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><Icon icon="DollarSign" size="md" /> 객단가</div>
          <p className="text-xl font-bold text-gray-900">{avgSpent.toLocaleString()}원</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><Icon icon="Target" /> 자동 캠페인</div>
          <p className="text-xl font-bold text-gray-900">{campaigns.filter(c => c.trigger_type !== 'MANUAL').length}건</p>
        </div>
      </div>

      {/* ── TAB: 캠페인 목록 ─────────────────────────────── */}
      {tab === 'campaigns' && <>
          {campaigns.length === 0 ? <EmptyState icon={Megaphone} title="등록된 캠페인이 없습니다" description="자동 마케팅 캠페인을 만들어 고객 방문을 유도하세요." action={{
        label: '캠페인 만들기',
        onClick: () => setTab('create')
      }} /> : <div className="space-y-3">
              {campaigns.map(c => {
          const meta = TRIGGER_META[c.trigger_type] || TRIGGER_META.MANUAL;
          const Icon = meta.icon;
          return <div key={c.id} className="rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-xl ${meta.bg} ${meta.color}`}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">{meta.label}</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusClass(c.is_active)}`}>
                              {c.is_active ? '활성' : '비활성'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            {c.target_tier && <span>대상 등급: {TIER_LABELS[c.target_tier] || c.target_tier}</span>}
                            {c.coupon && <span>쿠폰: {c.coupon.name} ({c.coupon.amount.toLocaleString()}원 할인)</span>}
                            <span>등록일: {new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleCampaign(c)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title={c.is_active ? '비활성화' : '활성화'}>
                          {c.is_active ? <Icon icon="Pause" size="md" /> : <Icon icon="Play" size="md" />}
                        </button>
                        <button onClick={() => deleteCampaign(c.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <Icon icon="Trash2" size="md" />
                        </button>
                      </div>
                    </div>
                  </div>;
        })}
            </div>}
        </>}

      {/* ── TAB: RFM 고객 분석 ───────────────────────────── */}
      {tab === 'analysis' && <>
          {analysis ? <>
              <div className="rounded-2xl border bg-white p-6 shadow-sm mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">RFM 세그먼트 분석</h3>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {segmentData.map(([seg, count]) => {
              const info = SEGMENT_INFO[seg] || {
                label: seg,
                color: 'text-gray-600 bg-gray-100'
              };
              const total = totalCustomers || 1;
              const pct = (count / total * 100).toFixed(0);
              return <div key={seg} className="rounded-xl border p-3 text-center">
                        <div className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold mb-1 ${info.color}`}>
                          {info.label}
                        </div>
                        <p className="text-xl font-bold text-gray-900">{count}명</p>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                          <div className="h-1.5 rounded-full bg-indigo-500" style={{
                    width: `${pct}%`
                  }} />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">전체의 {pct}%</p>
                        <button onClick={() => sendSmartSms(seg)} disabled={sending} className="mt-2 w-full text-xs py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 font-medium transition-colors">
                          {sending ? <Icon icon="Loader2" size="md" className="animate-spin inline" /> : null}
                          {' '}AI SMS 발송
                        </button>
                      </div>;
            })}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">세그먼트별 추천 액션</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-50">
                    <Icon icon="Sparkles" size="md" className="text-purple-500 mt-0.5 shrink-0" />
                    <div><strong className="text-purple-700">Champions (최우수):</strong> VIP 전용 쿠폰, 단독 이벤트 초대, 감사 메시지로 로열티 강화</div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50">
                    <Icon icon="Sparkles" size="md" className="text-blue-500 mt-0.5 shrink-0" />
                    <div><strong className="text-blue-700">Loyal (충성):</strong> 포인트 2배 적립 프로모션, 등급 업데이트 안내로 VIP 전환 유도</div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-50">
                    <Icon icon="Sparkles" size="md" className="text-orange-500 mt-0.5 shrink-0" />
                    <div><strong className="text-orange-700">At_Risk (이탈 위험):</strong> 할인 쿠폰 + 재방문 유도 SMS로 즉시 액션 필요</div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50">
                    <Icon icon="Sparkles" size="md" className="text-red-500 mt-0.5 shrink-0" />
                    <div><strong className="text-red-700">Lost (이탈):</strong> 강력 할인 쿠폰 + "그리웠어요" 메시지로 재유입 시도</div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-green-50">
                    <Icon icon="Sparkles" size="md" className="text-green-500 mt-0.5 shrink-0" />
                    <div><strong className="text-green-700">New (신규):</strong> 두 번째 방문 유도 쿠폰 발행 + 웰컴 메시지</div>
                  </div>
                </div>
              </div>
            </> : <EmptyState icon={BarChart3} title="RFM 분석 데이터 없음" description="고객 방문 기록이 쌓이면 자동으로 세그먼트가 분석됩니다." />}
        </>}

      {tab === 'automation' && <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">CRM 자동 캠페인 후보 생성</h3>
            <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
              <select value={automationSegment} onChange={(event) => setAutomationSegment(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                {['Champions', 'Loyal', 'At_Risk', 'Lost', 'New', 'General'].map((segment) => <option key={segment}>{segment}</option>)}
              </select>
              <input value={automationMessage} onChange={(event) => setAutomationMessage(event.target.value)} maxLength={80} placeholder="80자 이내 발송 메시지" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <button disabled={automationLoading} onClick={() => generateAutomation()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">후보 생성</button>
            </div>
            <p className="text-xs text-gray-400 mt-2">후보 생성 후 승인해야 실제 SMS가 발송됩니다.</p>
          </div>
          {automationRuns.length === 0 ? <EmptyState icon={Megaphone} title="승인 대기 캠페인이 없습니다" description="세그먼트를 선택해 발송 후보를 생성하세요." /> : <div className="space-y-3">
            {automationRuns.map((run) => <div key={run.id} className="rounded-2xl border bg-white p-5 shadow-sm flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">{run.segment_name} · {run.target_count}명</p>
                <p className="text-sm text-gray-500 mt-1">{run.message}</p>
                <p className="text-xs text-gray-400 mt-1">상태: {run.status}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {run.status === 'pending' && <><button onClick={() => decideAutomation(run.id, 'approved')} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">승인</button><button onClick={() => decideAutomation(run.id, 'rejected')} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">거절</button></>}
                {run.status === 'approved' && <button onClick={() => sendAutomation(run.id)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white">발송</button>}
              </div>
            </div>)}
          </div>}
        </div>}

      {/* ── TAB: 새 캠페인 생성 ──────────────────────────── */}
      {tab === 'create' && <div className="rounded-2xl border bg-white p-6 shadow-sm max-w-xl">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">새 캠페인 설정</h3>

          <div className="space-y-4">
            {/* 트리거 유형 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">트리거 유형</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TRIGGER_META).map(([key, meta]) => {
              const Icon = meta.icon;
              return <button key={key} onClick={() => setForm(p => ({
                ...p,
                trigger_type: key
              }))} className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all
                        ${form.trigger_type === key ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <Icon size={16} /> {meta.label}
                    </button>;
            })}
              </div>
            </div>

            {/* 등급 조건 (TIER_UP일 때) */}
            {form.trigger_type === 'TIER_UP' && <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">대상 등급</label>
                <select value={form.target_tier} onChange={e => setForm(p => ({
            ...p,
            target_tier: e.target.value
          }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
                  <option value="">등급 선택</option>
                  {Object.entries(TIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>}

            {/* 연결 쿠폰 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">연결 쿠폰</label>
              <select value={form.coupon_id} onChange={e => setForm(p => ({
            ...p,
            coupon_id: e.target.value
          }))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400">
                <option value="">쿠폰 선택</option>
                {coupons.map(c => <option key={c.id} value={c.id}>{c.name} ({c.amount.toLocaleString()}원 할인, {c.type})</option>)}
              </select>
              {coupons.length === 0 && <p className="text-xs text-amber-600 mt-1">먼저 쿠폰을 생성해주세요.</p>}
            </div>

            <button onClick={handleSave} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
              캠페인 저장
            </button>
          </div>
        </div>}
    </div>;
}
