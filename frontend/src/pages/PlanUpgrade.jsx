import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { storesAPI, planRequestsAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Crown, CheckCircle, XCircle, Clock, Sparkles, Store, TrendingUp, Shield, Target, MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-toastify';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '무료',
    desc: '기본 매장 운영 및 QR 코드 생성',
    color: 'from-slate-500 to-slate-700',
    border: 'border-slate-300',
    features: [
      '테이블별 무제한 QR 코드',
      '기본 모바일 웹 메뉴판',
      '실시간 조리 대기열 (KDS)',
      '기본 일일 매출 통계',
      '직원 1명 계정',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₩20,000/월',
    desc: '실시간 결제 및 부가 편의 기능',
    color: 'from-orange-500 to-rose-600',
    border: 'border-orange-400',
    popular: true,
    features: [
      'Toss Payments 라이브 결제',
      '실시간 매장 위치 공유',
      '고객 알림톡 발송',
      '긴급 품절 처리',
      '단골 마케팅 (찜·푸시)',
      '직원/매니저 무제한 계정',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '₩50,000/월',
    desc: '프리미엄 통합 매장 운영',
    color: 'from-purple-500 to-indigo-600',
    border: 'border-purple-400',
    features: [
      '모든 Pro 기능 포함',
      'AI 메뉴 분석·추천',
      '맞춤형 KDS 연동',
      '전용 담당 매니저 배정',
      '우선 기술 지원',
      'API 웹훅 연동',
    ],
  },
];

export default function PlanUpgrade() {
  const { storeId } = useParams();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    Promise.all([
      storesAPI.getById(storeId),
      planRequestsAPI.getByStore(storeId),
    ])
      .then(([storeRes, reqRes]) => {
        setStore(storeRes.data);
        setRequests(reqRes.data || []);
      })
      .catch(() => toast.error('정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [storeId]);

  const handleSubmit = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      await planRequestsAPI.create({
        store_id: parseInt(storeId),
        requested_plan: selectedPlan,
        reason,
      });
      toast.success('업그레이드 신청이 완료되었습니다.');
      setSelectedPlan(null);
      setReason('');
      const res = await planRequestsAPI.getByStore(storeId);
      setRequests(res.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || '신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentPlan = store?.plan || 'free';
  const planOrder = { free: 0, pro: 1, enterprise: 2 };
  const maxReachable = currentPlan === 'enterprise' ? currentPlan : 'enterprise';
  const pendingRequest = requests.find(r => r.status === 'pending');

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold"><CheckCircle size={12} />승인됨</span>;
      case 'rejected': return <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold"><XCircle size={12} />거절됨</span>;
      default: return <span className="flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold"><Clock size={12} />대기중</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mr-3" />
        불러오는 중...
      </div>
    );
  }

  const canUpgrade = currentPlan !== 'enterprise' && !pendingRequest;

  return (
    <div className="max-w-5xl mx-auto pb-24">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Crown className="text-orange-500" size={28} />
          <h1 className="text-2xl font-black text-white">멤버십 &amp; 플랜</h1>
        </div>
        <p className="text-slate-400 text-sm">현재 요금제를 확인하고 업그레이드 신청을 관리합니다</p>
      </div>

      {/* 현재 플랜 정보 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${PLANS.find(p => p.id === currentPlan)?.color || 'from-slate-500 to-slate-700'} flex items-center justify-center shadow-lg`}>
              <Store className="text-white" size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">현재 플랜</p>
              <p className="text-xl font-black text-white">{PLANS.find(p => p.id === currentPlan)?.name || currentPlan.toUpperCase()}</p>
              <p className="text-sm text-slate-400">{store?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pendingRequest && (
              <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-xs text-yellow-400 font-bold">업그레이드 대기중</p>
                <p className="text-xs text-yellow-500/70">{pendingRequest.requested_plan.toUpperCase()} → 승인 대기</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 요금제 비교 */}
      <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2">
        <Sparkles size={18} className="text-orange-400" />
        요금제 비교
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isDowngrade = planOrder[plan.id] < planOrder[currentPlan];
          const canSelect = plan.id !== currentPlan && !isDowngrade && !pendingRequest;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 transition-all ${
                isCurrent
                  ? 'border-orange-500 bg-orange-500/5 shadow-lg shadow-orange-500/10'
                  : selectedPlan === plan.id
                  ? 'border-blue-500 bg-blue-500/5'
                  : canSelect
                  ? 'border-white/10 bg-white/5 hover:border-white/20 cursor-pointer'
                  : 'border-white/5 bg-white/[0.02] opacity-60'
              }`}
              onClick={() => canSelect && setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-500 to-rose-500 rounded-full text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                  인기
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 right-3 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-[10px] font-black">
                  현재 요금제
                </div>
              )}

              <div className="p-6">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4 shadow-lg`}>
                  {plan.id === 'enterprise' ? <Crown className="text-white" size={20} /> :
                   plan.id === 'pro' ? <TrendingUp className="text-white" size={20} /> :
                   <Store className="text-white" size={20} />}
                </div>
                <h3 className="text-lg font-black text-white mb-1">{plan.name}</h3>
                <p className="text-2xl font-black text-white mb-1">{plan.price}</p>
                <p className="text-xs text-slate-400 mb-4">{plan.desc}</p>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle size={12} className="text-green-400 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-3 bg-orange-500/10 text-orange-400 rounded-xl text-sm font-bold text-center border border-orange-500/20">
                    현재 사용중
                  </div>
                ) : isDowngrade ? (
                  <div className="w-full py-3 bg-slate-800 text-slate-500 rounded-xl text-sm font-bold text-center">
                    다운그레이드 불가
                  </div>
                ) : selectedPlan === plan.id ? (
                  <div className="w-full py-3 bg-blue-500 text-white rounded-xl text-sm font-bold text-center">
                    선택됨
                  </div>
                ) : (
                  <div className={`w-full py-3 rounded-xl text-sm font-bold text-center transition-all ${
                    canSelect ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-800 text-slate-600'
                  }`}>
                    {canSelect ? '선택하기' : pendingRequest ? '승인 대기중' : '선택 불가'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 신청 폼 */}
      {selectedPlan && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-8">
          <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
            <Send size={18} className="text-orange-400" />
            업그레이드 신청
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            <span className="text-orange-400 font-bold">{currentPlan.toUpperCase()}</span>
            {' → '}
            <span className="text-blue-400 font-bold">{selectedPlan.toUpperCase()}</span>
            {' '}업그레이드를 신청합니다. 관리자가 승인 후 적용됩니다.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-300 mb-2">신청 사유 (선택)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="업그레이드가 필요한 이유를 간단히 적어주세요."
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 outline-none resize-none focus:border-orange-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-orange-500/20"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {submitting ? '신청 중...' : '업그레이드 신청'}
            </button>
            <button
              onClick={() => { setSelectedPlan(null); setReason(''); }}
              className="px-6 py-3 bg-white/5 text-slate-400 rounded-xl font-bold hover:bg-white/10 transition-all"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 신청 내역 */}
      {requests.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageSquare size={16} className="text-slate-400" />
              <span className="font-bold text-white">신청 내역</span>
              <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-slate-400">{requests.length}</span>
            </div>
            {showHistory ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>
          {showHistory && (
            <div className="px-6 pb-6 space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <span className="text-slate-300 font-bold">{req.current_plan?.toUpperCase()}</span>
                      <span className="text-slate-500 mx-2">→</span>
                      <span className="text-white font-bold">{req.requested_plan?.toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-slate-500">{new Date(req.created_at).toLocaleString('ko-KR')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(req.status)}
                    {req.admin_note && (
                      <span className="text-xs text-slate-500 max-w-[200px] truncate" title={req.admin_note}>
                        {req.admin_note}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* super_admin 전용: 관리 페이지 링크 */}
      {user?.role === 'super_admin' && (
        <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
          <p className="text-sm text-blue-300 font-bold flex items-center gap-2">
            <Shield size={14} />
            전체 관리자 권한으로 모든 신청을 관리하려면
            <a href="/admin/plan-requests" className="text-blue-400 underline hover:text-blue-300">신청 관리 페이지</a>
            로 이동하세요.
          </p>
        </div>
      )}
    </div>
  );
}
