import { useState } from 'react';
import { useParams } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Plus, Edit, Trash2, History, Play, BarChart3, Clock, Zap, Package, Users, RefreshCw, CheckCircle, XCircle, PauseCircle, Save, X } from 'lucide-react';
import { dynamicPricingAPI } from '@/api/admin';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatPrice } from '@/utils/format';
const RULE_TYPES = [{
  value: 'TIME_BASED',
  label: '시간대별',
  icon: Clock,
  color: 'bg-blue-100 text-blue-700'
}, {
  value: 'DEMAND_BASED',
  label: '수요 기반',
  icon: TrendingUp,
  color: 'bg-green-100 text-green-700'
}, {
  value: 'INVENTORY_BASED',
  label: '재고 기반',
  icon: Package,
  color: 'bg-purple-100 text-purple-700'
}, {
  value: 'WEATHER_BASED',
  label: '날씨 기반',
  icon: Zap,
  color: 'bg-yellow-100 text-yellow-700'
}, {
  value: 'COMPETITOR_BASED',
  label: '경쟁사 기반',
  icon: Users,
  color: 'bg-orange-100 text-orange-700'
}];
const JOB_STATUS = {
  PENDING: {
    label: '대기중',
    color: 'bg-gray-100 text-gray-700',
    icon: PauseCircle
  },
  RUNNING: {
    label: '실행중',
    color: 'bg-blue-100 text-blue-700',
    icon: RefreshCw
  },
  COMPLETED: {
    label: '완료',
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle
  },
  FAILED: {
    label: '실패',
    color: 'bg-red-100 text-red-700',
    icon: XCircle
  }
};
const DynamicPricingManager = ({
  storeId: storeIdProp
}) => {
  const { storeId: storeIdParam } = useParams();
  const storeId = storeIdProp || storeIdParam;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('rules');
  const [editingRule, setEditingRule] = useState(null);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [manualPrice, setManualPrice] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [ruleForm, setRuleForm] = useState({
    product_id: '',
    rule_name: '',
    rule_type: 'TIME_BASED',
    config: '{}',
    min_price: '',
    max_price: '',
    base_price: ''
  });

  // 가격 규칙 조회
  const {
    data: rulesData,
  } = useQuery({
    queryKey: ['pricing-rules', storeId],
    queryFn: () => dynamicPricingAPI.getRules(storeId).then(res => res.data),
    staleTime: 60000
  });

  // 가격 변경 이력 조회
  const {
    data: logsData,
  } = useQuery({
    queryKey: ['pricing-logs', storeId],
    queryFn: () => dynamicPricingAPI.getPriceLogs(storeId, {
      limit: 100
    }).then(res => res.data),
    staleTime: 60000,
    enabled: activeTab === 'logs'
  });

  // 최적화 작업 조회
  const {
    data: jobsData,
  } = useQuery({
    queryKey: ['pricing-jobs', storeId],
    queryFn: () => dynamicPricingAPI.getJobs(storeId).then(res => res.data),
    staleTime: 60000,
    enabled: activeTab === 'jobs'
  });

  // 수요 예측 조회
  const {
    data: forecastsData,
  } = useQuery({
    queryKey: ['pricing-forecasts', storeId],
    queryFn: () => dynamicPricingAPI.getForecasts(storeId).then(res => res.data),
    staleTime: 60000,
    enabled: activeTab === 'forecasts'
  });

  // 뮤테이션
  const deleteRuleMutation = useMutation({
    mutationFn: ruleId => dynamicPricingAPI.deleteRule(storeId, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries(['pricing-rules', storeId]);
    }
  });
  const runOptimizationMutation = useMutation({
    mutationFn: jobType => dynamicPricingAPI.runOptimization(storeId, {
      jobType
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['pricing-jobs', storeId]);
    }
  });
  const applyManualPriceMutation = useMutation({
    mutationFn: data => dynamicPricingAPI.applyManualPrice(storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['pricing-logs', storeId]);
      setShowPriceModal(false);
      setSelectedProduct(null);
    }
  });
  const createRuleMutation = useMutation({
    mutationFn: data => dynamicPricingAPI.createRule(storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['pricing-rules', storeId]);
      setShowRuleModal(false);
      setEditingRule(null);
    }
  });
  const updateRuleMutation = useMutation({
    mutationFn: ({
      ruleId,
      data
    }) => dynamicPricingAPI.updateRule(storeId, ruleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['pricing-rules', storeId]);
      setShowRuleModal(false);
      setEditingRule(null);
    }
  });
  const rules = rulesData?.items || rulesData || [];
  const logs = logsData?.items || logsData || [];
  const jobs = jobsData || [];
  const forecasts = forecastsData || [];
  const handleDeleteRule = async ruleId => {
    if (window.confirm('이 가격 규칙을 삭제하시겠습니까?')) {
      await deleteRuleMutation.mutateAsync(ruleId);
    }
  };
  const handleRunOptimization = async jobType => {
    if (window.confirm(`가격 최적화 작업 (${jobType})을 실행하시겠습니까?`)) {
      await runOptimizationMutation.mutateAsync(jobType);
    }
  };
  const handleManualPrice = async () => {
    if (!selectedProduct || !manualPrice) return;
    await applyManualPriceMutation.mutateAsync({
      productId: selectedProduct.id,
      newPrice: parseInt(manualPrice),
      reason: manualReason
    });
  };
  const openRuleModal = (rule = null) => {
    if (rule) {
      setRuleForm({
        product_id: rule.product_id || '',
        rule_name: rule.rule_name || '',
        rule_type: rule.rule_type || 'TIME_BASED',
        config: rule.config ? JSON.stringify(rule.config, null, 2) : '{}',
        min_price: rule.min_price || '',
        max_price: rule.max_price || '',
        base_price: rule.base_price || ''
      });
    } else {
      setRuleForm({
        product_id: '',
        rule_name: '',
        rule_type: 'TIME_BASED',
        config: '{}',
        min_price: '',
        max_price: '',
        base_price: ''
      });
    }
    setEditingRule(rule);
    setShowRuleModal(true);
  };
  const handleSaveRule = async () => {
    const data = {
      product_id: Number(ruleForm.product_id),
      rule_name: ruleForm.rule_name,
      rule_type: ruleForm.rule_type,
      min_price: Number(ruleForm.min_price),
      max_price: Number(ruleForm.max_price),
      base_price: Number(ruleForm.base_price),
      config: JSON.parse(ruleForm.config || '{}')
    };
    if (editingRule) {
      await updateRuleMutation.mutateAsync({
        ruleId: editingRule.id,
        data
      });
    } else {
      await createRuleMutation.mutateAsync(data);
    }
  };
  const getRuleTypeConfig = type => RULE_TYPES.find(r => r.value === type) || RULE_TYPES[0];
  return <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="flex gap-2 border-b border-slate-200">
        {[{
        id: 'rules',
        label: '가격 규칙',
        icon: TrendingUp
      }, {
        id: 'logs',
        label: '변경 이력',
        icon: History
      }, {
        id: 'jobs',
        label: '최적화 작업',
        icon: Play
      }, {
        id: 'forecasts',
        label: '수요 예측',
        icon: BarChart3
      }].map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === tab.id ? 'border-orange-500 text-orange-600 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
            <tab.icon size={16} />
            {tab.label}
          </button>)}
      </div>

      {/* 가격 규칙 탭 */}
      {activeTab === 'rules' && <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">동적 가격 책정 규칙</h3>
            <button onClick={() => openRuleModal()} className="px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors flex items-center gap-2">
              <Plus size={16} />
              규칙 추가
            </button>
          </div>

          {rules.length === 0 ? <div className="text-center py-12 bg-slate-50 rounded-2xl">
              <TrendingUp size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">가격 책정 규칙이 없습니다. 추가하려면 위 버튼을 클릭하세요.</p>
            </div> : <div className="space-y-3">
              {rules.map(rule => {
          const typeConfig = getRuleTypeConfig(rule.rule_type);
          const TypeIcon = typeConfig.icon;
          return <div key={rule.id} className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${typeConfig.color}`}>
                          <TypeIcon size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold">{rule.rule_name}</h4>
                          <p className="text-sm text-slate-500">
                            {rule.products?.name || `상품 #${rule.product_id}`} • {typeConfig.label}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {rule.is_active ? '활성' : '비활성'}
                        </span>
                        <button onClick={() => openRuleModal(rule)} className="p-1 text-slate-600 hover:text-slate-900">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDeleteRule(rule.id)} className="p-1 text-red-600 hover:text-red-700">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">기준 가격</span>
                        <span className="font-bold ml-1">{formatPrice(rule.base_price || 0)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">최소 가격</span>
                        <span className="font-bold ml-1">{formatPrice(rule.min_price || 0)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">최대 가격</span>
                        <span className="font-bold ml-1">{formatPrice(rule.max_price || 0)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">우선순위</span>
                        <span className="font-bold ml-1">{rule.priority}</span>
                      </div>
                    </div>
                  </div>;
        })}
            </div>}

          {/* 최적화 실행 버튼 */}
          <div className="flex gap-2 pt-4 border-t">
            <button onClick={() => handleRunOptimization('INCREMENTAL_UPDATE')} disabled={runOptimizationMutation.isPending} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors flex items-center gap-2">
              <RefreshCw size={16} />
              증분 최적화
            </button>
            <button onClick={() => handleRunOptimization('FULL_OPTIMIZATION')} disabled={runOptimizationMutation.isPending} className="px-4 py-2 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-colors flex items-center gap-2">
              <Play size={16} />
              전체 최적화
            </button>
          </div>
        </motion.div>}

      {/* 변경 이력 탭 */}
      {activeTab === 'logs' && <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} className="space-y-4">
          <h3 className="text-lg font-bold">가격 변경 이력</h3>
          {logs.length === 0 ? <div className="text-center py-12 bg-slate-50 rounded-2xl">
              <History size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">가격 변경 이력이 없습니다.</p>
            </div> : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2">상품</th>
                    <th className="px-4 py-2">이전 가격</th>
                    <th className="px-4 py-2">변경 가격</th>
                    <th className="px-4 py-2">트리거</th>
                    <th className="px-4 py-2">AI 이유</th>
                    <th className="px-4 py-2">시간</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => <tr key={log.id} className="border-t">
                      <td className="px-4 py-2">{log.products?.name || `#${log.product_id}`}</td>
                      <td className="px-4 py-2">{formatPrice(log.old_price)}</td>
                      <td className="px-4 py-2 font-bold text-orange-600">{formatPrice(log.new_price)}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs px-2 py-1 bg-slate-100 rounded-full">
                          {log.trigger_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{log.ai_reasoning || '-'}</td>
                      <td className="px-4 py-2 text-slate-500">
                        {new Date(log.created_at).toLocaleString('ko-KR')}
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>}
        </motion.div>}

      {/* 최적화 작업 탭 */}
      {activeTab === 'jobs' && <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} className="space-y-4">
          <h3 className="text-lg font-bold">최적화 작업 목록</h3>
          {jobs.length === 0 ? <div className="text-center py-12 bg-slate-50 rounded-2xl">
              <Play size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">최적화 작업이 없습니다.</p>
            </div> : <div className="space-y-3">
              {jobs.map(job => {
          const statusConfig = JOB_STATUS[job.status] || JOB_STATUS.PENDING;
          const StatusIcon = statusConfig.icon;
          return <div key={job.id} className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${statusConfig.color}`}>
                          <StatusIcon size={20} className={job.status === 'RUNNING' ? 'animate-spin' : ''} />
                        </div>
                        <div>
                          <h4 className="font-bold">{job.job_type}</h4>
                          <p className="text-sm text-slate-500">
                            {job.started_at ? new Date(job.started_at).toLocaleString('ko-KR') : '-'}
                            {job.completed_at && ` ~ ${new Date(job.completed_at).toLocaleString('ko-KR')}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        {job.result_summary && <div className="text-xs text-slate-500 mt-1">
                            규칙: {job.result_summary.rulesUpdated}, 가격 변경: {job.result_summary.pricesChanged}
                          </div>}
                      </div>
                    </div>
                  </div>;
        })}
            </div>}
        </motion.div>}

      {/* 수요 예측 탭 */}
      {activeTab === 'forecasts' && <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} className="space-y-4">
          <h3 className="text-lg font-bold">수요 예측</h3>
          {forecasts.length === 0 ? <div className="text-center py-12 bg-slate-50 rounded-2xl">
              <BarChart3 size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">수요 예측 데이터가 없습니다. 최적화 작업을 실행하면 생성됩니다.</p>
            </div> : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2">상품</th>
                    <th className="px-4 py-2">예측일</th>
                    <th className="px-4 py-2">예측 수요</th>
                    <th className="px-4 py-2">신뢰도</th>
                    <th className="px-4 py-2">요인</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map(f => <tr key={f.id} className="border-t">
                      <td className="px-4 py-2">{f.products?.name || `#${f.product_id}`}</td>
                      <td className="px-4 py-2">{new Date(f.forecast_date).toLocaleDateString('ko-KR')}</td>
                      <td className="px-4 py-2 font-bold">{f.predicted_demand}개</td>
                      <td className="px-4 py-2">
                        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500" style={{
                    width: `${f.confidence_score * 100}%`
                  }} />
                        </div>
                        <span className="text-xs text-slate-500">{(f.confidence_score * 100).toFixed(0)}%</span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {f.factors && Object.entries(f.factors).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>}
        </motion.div>}

      {/* 수동 가격 변경 모달 */}
      <AnimatePresence>
        {showPriceModal && selectedProduct && <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0
      }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div initial={{
          scale: 0.9
        }} animate={{
          scale: 1
        }} exit={{
          scale: 0.9
        }} className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4">수동 가격 변경</h3>
              <p className="text-sm text-slate-600 mb-4">
                <span className="font-bold">{selectedProduct.name}</span>
                <span className="ml-2 text-slate-500">(현재: {formatPrice(selectedProduct.price)})</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">새 가격 (원)</label>
                  <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="예: 15000" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">변경 사유</label>
                  <textarea value={manualReason} onChange={e => setManualReason(e.target.value)} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" rows={3} placeholder="변경 이유를 입력하세요..." />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => {
              setShowPriceModal(false);
              setSelectedProduct(null);
            }} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold">
                  취소
                </button>
                <button onClick={handleManualPrice} disabled={!manualPrice || applyManualPriceMutation.isPending} className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50">
                  적용
                </button>
              </div>
            </motion.div>
          </motion.div>}
      </AnimatePresence>

      {/* 가격 규칙 생성/수정 모달 */}
      <AnimatePresence>
        {showRuleModal && <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0
      }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRuleModal(false)}>
            <motion.div initial={{
          scale: 0.9
        }} animate={{
          scale: 1
        }} exit={{
          scale: 0.9
        }} className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">
                  {editingRule ? '가격 규칙 수정' : '새 가격 규칙'}
                </h3>
                <button onClick={() => setShowRuleModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">규칙 이름</label>
                  <input type="text" value={ruleForm.rule_name} onChange={e => setRuleForm(f => ({
                ...f,
                rule_name: e.target.value
              }))} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="예: 점심 시간 할인" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">규칙 유형</label>
                    <select value={ruleForm.rule_type} onChange={e => setRuleForm(f => ({
                  ...f,
                  rule_type: e.target.value
                }))} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">상품 ID</label>
                    <input type="number" value={ruleForm.product_id} onChange={e => setRuleForm(f => ({
                  ...f,
                  product_id: e.target.value
                }))} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">기준 가격</label>
                    <input type="number" value={ruleForm.base_price} onChange={e => setRuleForm(f => ({
                  ...f,
                  base_price: e.target.value
                }))} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">최소 가격</label>
                    <input type="number" value={ruleForm.min_price} onChange={e => setRuleForm(f => ({
                  ...f,
                  min_price: e.target.value
                }))} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">최대 가격</label>
                    <input type="number" value={ruleForm.max_price} onChange={e => setRuleForm(f => ({
                  ...f,
                  max_price: e.target.value
                }))} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">설정 (JSON)</label>
                  <textarea value={ruleForm.config} onChange={e => setRuleForm(f => ({
                ...f,
                config: e.target.value
              }))} className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm" rows={3} placeholder='{"timeSlots":[{"startHour":11,"endHour":14,"multiplier":0.9}]}' />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowRuleModal(false)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold">
                  취소
                </button>
                <button onClick={handleSaveRule} disabled={createRuleMutation.isPending || updateRuleMutation.isPending} className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save size={16} />
                  저장
                </button>
              </div>
            </motion.div>
          </motion.div>}
      </AnimatePresence>
    </div>;
};
export default DynamicPricingManager;
