import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Sparkles,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  ClipboardCheck,
  MessageSquare,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { storeManagerAPI } from '../../api/storeManager';
import './menu/menuWorkspace.css';

const unwrap = (response) => response?.data || response;
const errorText = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  '매장 매니저 요청을 처리하지 못했습니다.';
const won = (amount) => `${Math.round(Number(amount || 0)).toLocaleString('ko-KR')}원`;
const date = (value) =>
  value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '—';
const statusLabels = {
  proposed: '제안',
  approved: '승인됨',
  running: '진행 중',
  stopped: '중단',
  completed: '평가 완료',
  dismissed: '보류',
};
const verdictLabels = {
  observed_improvement: '개선 관측',
  observed_decline: '감소 관측',
  unchanged: '변화 없음',
  insufficient: '표본 부족',
  pending: '평가 대기',
  stopped: '중단된 실험',
};

export default function AIStoreManager() {
  const { storeId } = useParams();
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  const [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState(null),
    [evaluations, setEvaluations] = useState({});
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(unwrap(await storeManagerAPI.briefing(storeId)));
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setLoading(false);
    }
  }, [storeId]);
  useEffect(() => {
    setData(null);
    setAnswer(null);
    setEvaluations({});
    void load();
  }, [load]);
  const run = async (action, event) => {
    if (
      event === 'execute' &&
      !window.confirm(
        `${action.payload.title}\n7일간 고객 QR 메뉴에 노출합니다. 할인·문자 발송은 실행하지 않습니다. 적용할까요?`
      )
    )
      return;
    setBusy(action.id);
    try {
      await storeManagerAPI.transition(storeId, action.id, event);
      await load();
      toast.success(
        event === 'execute' ? '고객 QR 메뉴 추천 노출을 시작했습니다.' : '제안 상태를 변경했습니다.'
      );
    } catch (failure) {
      toast.error(errorText(failure));
    } finally {
      setBusy('');
    }
  };
  const evaluate = async (action) => {
    setBusy(action.id);
    try {
      const result = unwrap(await storeManagerAPI.evaluate(storeId, action.id));
      setEvaluations((previous) => ({ ...previous, [action.id]: result }));
      await load();
    } catch (failure) {
      toast.error(errorText(failure));
    } finally {
      setBusy('');
    }
  };
  const ask = async (event) => {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy('chat');
    setAnswer(null);
    try {
      setAnswer(unwrap(await storeManagerAPI.chat(storeId, question)));
    } catch (failure) {
      toast.error(errorText(failure));
    } finally {
      setBusy('');
    }
  };
  const currentActions = (data?.actions || []).filter(
    (a) => a.status !== 'proposed' || Date.now() - new Date(a.created_at).getTime() < 86400000
  );
  return (
    <div
      className="menu-workspace max-w-7xl mx-auto px-3 sm:px-6 pb-24 space-y-6"
      style={{ color: 'var(--menu-text)' }}
    >
      <header className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <p className="text-xs font-semibold text-orange-500 tracking-widest mb-2">
            WEMARKET · STORE MANAGER
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Sparkles size={26} />
            AI 매장 매니저
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            오늘의 문제부터 실행과 결과까지, 매장 데이터를 함께 살펴보세요.
          </p>
        </div>
        <button
          className="menu-quiet rounded-xl px-4 inline-flex items-center gap-2"
          disabled={loading || !!busy}
          onClick={load}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </header>
      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 p-4 text-rose-400">
          {error}{' '}
          <button className="underline ml-2" onClick={load}>
            다시 조회
          </button>
        </div>
      )}
      {loading && !data && (
        <div className="menu-panel rounded-2xl p-8" role="status">
          매장 주문과 리뷰를 확인하고 있습니다…
        </div>
      )}
      {data && (
        <>
          <section className="menu-panel rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="text-lg font-bold">
                사장님, {data.store?.name}의 오늘을 확인해보세요.
              </h2>
              <span className="text-xs text-slate-400">기준 {date(data.as_of)} · 5분 캐시</span>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                ['자체 주문 순매출', won(data.current?.revenue)],
                ['자체 결제 주문', `${data.current?.orders || 0}건`],
                [
                  '동일 요일 평균',
                  data.historical?.days >= 4 ? won(data.historical.revenue) : '비교 데이터 부족',
                ],
                ['최근 자체 리뷰', `${data.review?.count || 0}건`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-500/15 p-4">
                  <p className="text-xs text-slate-400 mb-2">{label}</p>
                  <p className="text-xl font-bold break-words">{value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              오늘 {data.clock?.hour}시 이전의 완료된 시간대 기준 · 매출은 주문 결제액에서 환불을
              차감합니다.
            </p>
            <div className="space-y-2">
              {(data.insights || []).map((insight) => (
                <article
                  key={insight.key}
                  className={`rounded-xl p-4 border ${insight.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-500/20'}`}
                >
                  <h3 className="font-semibold">{insight.title}</h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">{insight.detail}</p>
                </article>
              ))}
            </div>
          </section>
          <section aria-label="실행 제안" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ClipboardCheck size={20} />
                제안과 진행 중인 실험
              </h2>
              <span className="text-xs text-slate-400">소유주 승인 후 실행 · 매장당 실험 1개</span>
            </div>
            {!currentActions.length && (
              <div className="menu-panel rounded-xl p-5 text-sm text-slate-400">
                조건에 맞는 실행 제안이 없습니다. 최근 완료된 영업일의 주문 30건과 판매 가능한
                메뉴의 판매 수량 5개가 확보되면 제안합니다.
              </div>
            )}
            <div className="grid xl:grid-cols-2 gap-4">
              {currentActions.map((action) => {
                const result = evaluations[action.id] || action.evaluation;
                const expired = Date.now() - new Date(action.created_at).getTime() > 86400000;
                const activeEnded =
                  action.status === 'running' && new Date(action.ends_at) <= new Date();
                return (
                  <article key={action.id} className="menu-panel rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-orange-500">
                        {action.kind === 'menu_feature' ? '메뉴 추천' : '시간대 프로모션'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {activeEnded ? '노출 종료 · 평가 가능' : statusLabels[action.status]}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg">{action.payload.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {action.payload.reason}
                    </p>
                    <div className="text-xs text-slate-400 flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={14} />
                        7일 · 할인 없음
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck size={14} />
                        고객 QR 추천 영역
                      </span>
                    </div>
                    {action.started_at && (
                      <p className="text-xs text-slate-400">
                        {date(action.started_at)} ~ {date(action.ends_at)}
                      </p>
                    )}
                    {expired && ['proposed', 'approved'].includes(action.status) && (
                      <p className="text-xs text-amber-500">
                        만료된 제안입니다. 최신 브리핑에서 확인하세요.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {data.can_execute && !expired && action.status === 'proposed' && (
                        <button
                          disabled={!!busy}
                          className="menu-primary rounded-lg px-4"
                          onClick={() => run(action, 'approve')}
                        >
                          제안 승인
                        </button>
                      )}
                      {data.can_execute && !expired && action.status === 'approved' && (
                        <button
                          disabled={!!busy}
                          className="menu-primary rounded-lg px-4"
                          onClick={() => run(action, 'execute')}
                        >
                          미리보기 확인 후 적용
                        </button>
                      )}
                      {data.can_execute && action.status === 'running' && !activeEnded && (
                        <button
                          disabled={!!busy}
                          className="menu-quiet rounded-lg px-4"
                          onClick={() => run(action, 'stop')}
                        >
                          노출 중단
                        </button>
                      )}
                      {data.can_execute && ['proposed', 'approved'].includes(action.status) && (
                        <button
                          disabled={!!busy}
                          className="menu-quiet rounded-lg px-4"
                          onClick={() => run(action, 'dismiss')}
                        >
                          보류
                        </button>
                      )}
                      {action.started_at && (
                        <button
                          disabled={!!busy}
                          className="menu-quiet rounded-lg px-4 inline-flex items-center gap-1"
                          onClick={() => evaluate(action)}
                        >
                          <TrendingUp size={14} />
                          효과 확인
                        </button>
                      )}
                    </div>
                    {result && (
                      <div
                        className="rounded-xl border border-slate-500/20 p-4 space-y-2"
                        role="status"
                      >
                        <h4 className="font-semibold">
                          {verdictLabels[result.verdict] || '효과 보고'}
                        </h4>
                        <p className="text-xs text-slate-400">{result.message}</p>
                        {result.before && (
                          <p className="text-sm">
                            메뉴 포함 주문 비중: {(result.before.share * 100).toFixed(1)}% →{' '}
                            {(result.after.share * 100).toFixed(1)}%<br />
                            <span className="text-xs text-slate-400">
                              전후 주문 {result.before.orders}건 / {result.after.orders}건 · 대조군
                              없음
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          <section className="menu-panel rounded-2xl p-5 space-y-4">
            <h2 className="font-bold flex items-center gap-2">
              <MessageSquare size={20} />
              매니저에게 물어보기
            </h2>
            <div className="flex flex-wrap gap-2">
              {[
                '오늘 어떤 문제가 있나요?',
                '어떤 메뉴를 추천하나요?',
                '어느 시간대가 좋을까요?',
                '지난 제안의 효과는 어땠나요?',
              ].map((text) => (
                <button
                  key={text}
                  type="button"
                  className="menu-quiet rounded-lg px-3 text-xs"
                  onClick={() => setQuestion(text)}
                >
                  {text}
                </button>
              ))}
            </div>
            <form onSubmit={ask} className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="manager-question">
                매장 분석 질문
              </label>
              <input
                id="manager-question"
                className="menu-field rounded-xl p-3 flex-1 min-w-0"
                placeholder="메뉴·시간대·문제·지난 결과를 질문하세요"
                maxLength={500}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                required
              />
              <button disabled={!!busy} className="menu-primary rounded-xl px-4">
                {busy === 'chat' ? '확인 중…' : '질문하기'}
              </button>
            </form>
            {answer && (
              <div
                role="status"
                className="rounded-xl border border-slate-500/20 p-4 whitespace-pre-line text-sm leading-relaxed"
              >
                {answer.explanation && <p className="mb-3 font-semibold">{answer.explanation}</p>}
                {answer.reply}
                <p className="text-xs text-slate-400 mt-3">
                  {answer.engine === 'verified_rules'
                    ? '검증된 지표 기반 답변'
                    : '검증된 지표 + AI 안내'}{' '}
                  · {date(answer.as_of)}
                </p>
              </div>
            )}
            <p className="text-xs text-slate-400">
              현재 매장의 확인된 지표 안에서 답변합니다. AI 안내는 매장당 하루 최대 5회이며 나머지는
              지표 기반 답변을 제공합니다.
            </p>
          </section>
          <section className="menu-panel rounded-xl p-4 text-xs text-slate-400 space-y-2">
            <h2 className="font-semibold text-sm">데이터 범위</h2>
            {(data.notes || []).map((note) => (
              <p key={note}>{note}</p>
            ))}
            <p>
              외부 연결 {data.coverage?.external_connections || 0}개 · 수집 확인 필요{' '}
              {data.coverage?.stale_connections || 0}개 · 통합 30일 순매출{' '}
              {won(data.integrated?.total_revenue)}
            </p>
            <Link
              className="text-orange-500 inline-flex items-center gap-1"
              to={`/admin/stores/${storeId}/integrations`}
            >
              데이터 연결 확인
              <ArrowRight size={14} />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
