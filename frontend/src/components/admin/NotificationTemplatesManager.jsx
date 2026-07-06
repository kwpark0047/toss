import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { notificationTemplatesAPI } from '../../api/notifications';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight,
  Save, Megaphone, MessageSquare, Smartphone, Globe, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import Button from '../common/Button';

const NOTIFICATION_TYPES = [
  { value: 'NEW_ORDER', label: '새 주문' },
  { value: 'ORDER_STATUS', label: '주문 상태 변경' },
  { value: 'LOW_STOCK', label: '재고 부족' },
  { value: 'NEW_REVIEW', label: '새 리뷰' },
  { value: 'NEW_RESERVATION', label: '새 예약' },
  { value: 'MANAGER_CALL', label: '매니저 호출' },
  { value: 'SETTLEMENT', label: '정산' },
  { value: 'SYSTEM', label: '시스템' },
];

const CHANNELS = [
  { value: 'all', label: '전체 채널' },
  { value: 'push', label: '푸시 알림' },
  { value: 'socket', label: '실시간 알림' },
  { value: 'alimtalk', label: '알림톡' },
];

const emptyTemplate = {
  type: 'SYSTEM',
  channel: 'all',
  title: '',
  message: '',
  variables: [],
  is_active: true,
};

const NotificationTemplatesManager = () => {
  const { storeId } = useParams();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | template object
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationTemplatesAPI.getList(storeId);
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('템플릿 목록을 불러오는데 실패했습니다.');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (form.id) {
        await notificationTemplatesAPI.update(form.id, form);
        toast.success('템플릿이 수정되었습니다.');
      } else {
        await notificationTemplatesAPI.create({ ...form, store_id: Number(storeId) });
        toast.success('템플릿이 생성되었습니다.');
      }
      setEditing(null);
      fetchTemplates();
    } catch (err) {
      toast.error('저장에 실패했습니다: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 템플릿을 삭제하시겠습니까?')) return;
    try {
      await notificationTemplatesAPI.delete(id);
      toast.success('템플릿이 삭제되었습니다.');
      fetchTemplates();
    } catch (err) {
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleToggleActive = async (template) => {
    try {
      await notificationTemplatesAPI.update(template.id, { is_active: !template.is_active });
      toast.success(template.is_active ? '템플릿이 비활성화되었습니다.' : '템플릿이 활성화되었습니다.');
      fetchTemplates();
    } catch (err) {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const typeLabel = (type) => NOTIFICATION_TYPES.find(t => t.value === type)?.label || type;
  const channelLabel = (ch) => CHANNELS.find(c => c.value === ch)?.label || ch;

  // ── Edit Modal ──
  const EditModal = () => {
    const data = editing === 'new' ? emptyTemplate : editing;
    const [form, setForm] = useState({ ...data, variables: Array.isArray(data.variables) ? data.variables.join(', ') : '' });

    const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!form.title.trim() || !form.message.trim()) {
        toast.warn('제목과 내용을 모두 입력해주세요.');
        return;
      }
      handleSave({
        ...form,
        variables: form.variables ? form.variables.split(',').map(v => v.trim()).filter(Boolean) : []
      });
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 rounded-[32px] border border-white/10 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <h2 className="text-lg font-black text-white">
              {data.id ? '템플릿 수정' : '새 템플릿'}
            </h2>
            <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">알림 유형</label>
                <select
                  value={form.type}
                  onChange={e => handleChange('type', e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500/50"
                >
                  {NOTIFICATION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">발송 채널</label>
                <select
                  value={form.channel}
                  onChange={e => handleChange('channel', e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500/50"
                >
                  {CHANNELS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">템플릿 제목</label>
              <input
                type="text"
                value={form.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="e.g. 새 주문 알림"
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500/50 placeholder-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">템플릿 내용</label>
              <textarea
                value={form.message}
                onChange={e => handleChange('message', e.target.value)}
                placeholder="알림 내용을 입력하세요. 변수는 {{변수명}} 형식으로 사용합니다."
                rows={4}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500/50 placeholder-slate-600 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">사용 가능한 변수 (쉼표 구분)</label>
              <input
                type="text"
                value={form.variables}
                onChange={e => handleChange('variables', e.target.value)}
                placeholder="orderNumber, customerName, storeName"
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-500/50 placeholder-slate-600"
              />
              <p className="text-[10px] text-slate-500 mt-1">템플릿 내에서 <code className="text-orange-400 bg-orange-500/10 px-1 rounded">{'{{변수명}}'}</code> 형식으로 사용됩니다.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => handleChange('is_active', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500" />
              </label>
              <span className="text-sm text-slate-300 font-medium">활성화</span>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/5">
              <Button type="submit" variant="gradient" size="md" fullWidth loading={saving} className="flex-1">
                <Save size={16} />
                저장
              </Button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all"
              >
                취소
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 max-h-[calc(100vh-80px)] overflow-y-auto space-y-3">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} dark className="h-20 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 max-h-[calc(100vh-80px)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Bell className="text-orange-400" /> 알림 템플릿
          </h1>
          <p className="text-slate-400 mt-1">매장 알림 메시지 템플릿을 관리합니다. 기본 템플릿은 자동으로 적용됩니다.</p>
        </div>
        <Button variant="gradient" size="md" onClick={() => setEditing('new')}>
          <Plus size={16} /> 새 템플릿
        </Button>
      </div>

      {/* Template List */}
      {templates.length === 0 ? (
        <EmptyState
          tone="dark"
          icon={<Bell className="text-slate-600" size={44} aria-hidden="true" />}
          title="등록된 알림 템플릿이 없습니다"
          description="'새 템플릿' 버튼을 눌러 첫 템플릿을 추가하세요."
        />
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white/5 rounded-[20px] border ${template.is_active ? 'border-white/10' : 'border-slate-700/50'} p-5 hover:bg-white/[0.07] transition-all`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2.5 py-1 bg-orange-500/10 text-orange-400 rounded-lg text-[10px] font-bold">
                      {typeLabel(template.type)}
                    </span>
                    <span className="px-2.5 py-1 bg-slate-700/50 text-slate-300 rounded-lg text-[10px] font-bold">
                      {channelLabel(template.channel)}
                    </span>
                    {!template.is_active && (
                      <span className="px-2.5 py-1 bg-slate-700 text-slate-500 rounded-lg text-[10px] font-bold">비활성</span>
                    )}
                    {template.store_id === null && (
                      <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-[10px] font-bold">기본</span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white truncate">{template.title}</h3>
                  <p className="text-sm text-slate-400 mt-1 line-clamp-2">{template.message}</p>
                  {template.variables && Array.isArray(template.variables) && template.variables.length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-2">
                      변수: {template.variables.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(template)}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                    title={template.is_active ? '비활성화' : '활성화'}
                  >
                    {template.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                  <button
                    onClick={() => setEditing(template)}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                    title="수정"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all"
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit / Create Modal */}
      <AnimatePresence>
        {editing && <EditModal />}
      </AnimatePresence>
    </div>
  );
};

export default NotificationTemplatesManager;
