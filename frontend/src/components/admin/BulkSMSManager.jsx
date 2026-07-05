import { useState, useEffect, useCallback } from 'react';
import { bulkSmsAPI } from '../../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Smartphone, Filter, Search, Send, Users,
    Store, MapPin, Zap, MessageSquare, AlertCircle,
    CheckCircle, Clock, Trash2, ChevronRight, RefreshCcw
} from 'lucide-react';
import { formatPrice } from '../../utils/format';

const BulkSMSManager = () => {
    const [options, setOptions] = useState({ stores: [], regions: [], businessTypes: [] });
    const [filters, setFilters] = useState({ storeId: '', region: '', businessType: '' });
    const [customers, setCustomers] = useState([]);
    const [targetCount, setTargetCount] = useState(0);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);

    // 필터 옵션 로드
    const fetchOptions = useCallback(async () => {
        try {
            const res = await bulkSmsAPI.getFilterOptions();
            setOptions(res.data);
        } catch (err) {
            console.error('필터 옵션 로드 실패:', err);
        }
    }, []);

    // 필터링된 고객 조회
    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await bulkSmsAPI.getFilteredCustomers(filters);
            setCustomers(res.data.customers);
            setTargetCount(res.data.count);
        } catch (err) {
            console.error('고객 필터링 실패:', err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSend = async () => {
        if (!message.trim()) return alert('메시지 내용을 입력해주세요.');
        if (targetCount === 0) return alert('발송 대상이 없습니다.');

        if (!window.confirm(`${targetCount}명에게 SMS를 발송하시겠습니까?`)) return;

        setSending(true);
        try {
            const res = await bulkSmsAPI.sendBulkSms({ filters, message });
            setSendResult(res.data);
            setMessage('');
        } catch (err) {
            alert('발송 실패: ' + (err.response?.data?.error || err.message));
        } finally {
            setSending(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8 pb-20"
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 text-blue-600 mb-2">
                        <Smartphone size={24} className="animate-bounce" />
                        <span className="text-xs font-black uppercase tracking-[0.2em]">Unified Marketing</span>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight">Bulk <span className="text-blue-400">SMS</span> Console</h1>
                    <p className="text-slate-400 mt-2 font-medium">전체 매장의 단골 고객데이터를 지역/업종별로 타겟팅하여 발송합니다.</p>
                </div>

                <div className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-soft border border-slate-100">
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1">Total Targets</p>
                        <p className="text-2xl font-black text-blue-600 leading-none">{targetCount.toLocaleString()} <span className="text-sm">명</span></p>
                    </div>
                    <div className="w-px h-8 bg-slate-100 mx-2"></div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Users size={24} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Filters & Target Preview */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="glass-panel p-6 border-white/60 shadow-xl overflow-visible">
                        <div className="flex items-center gap-3 mb-6">
                            <Filter className="text-slate-400" size={20} />
                            <h2 className="text-lg font-black text-slate-900">Advanced Filtering</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <Store size={12} /> Store Filter
                                </label>
                                <select aria-label="매장 필터"
                                    name="storeId"
                                    value={filters.storeId}
                                    onChange={handleFilterChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer appearance-none"
                                >
                                    <option value="">전체 매장 (All Stores)</option>
                                    {options.stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <MapPin size={12} /> Region Group
                                </label>
                                <select aria-label="지역 필터"
                                    name="region"
                                    value={filters.region}
                                    onChange={handleFilterChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer appearance-none"
                                >
                                    <option value="">전체 지역 (All Regions)</option>
                                    {options.regions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                                    <Zap size={12} /> Industry Type
                                </label>
                                <select aria-label="업종 필터"
                                    name="businessType"
                                    value={filters.businessType}
                                    onChange={handleFilterChange}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer appearance-none"
                                >
                                    <option value="">전체 업종 (All Industries)</option>
                                    {options.businessTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                    </section>

                    <section className="glass-panel overflow-hidden border-white/60 shadow-xl min-h-[400px]">
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white/50">
                            <h2 className="text-lg font-black flex items-center gap-3">
                                <Users className="text-blue-500" size={24} />
                                Target List Preview
                                <span className="text-xs font-bold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full ml-2">Show 100 max</span>
                            </h2>
                            <button
                                onClick={fetchCustomers}
                                className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                                <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        <div className="divide-y divide-slate-50 overflow-y-auto max-h-[500px]">
                            {loading ? (
                                <div className="p-20 text-center space-y-4">
                                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    <p className="text-slate-400 font-bold animate-pulse">Filtering Customers...</p>
                                </div>
                            ) : customers.length === 0 ? (
                                <div className="p-20 text-center space-y-4">
                                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-200">
                                        <Users size={32} />
                                    </div>
                                    <p className="text-slate-400 font-bold">대상 고객이 없습니다. 필터를 변경해 보세요.</p>
                                </div>
                            ) : (
                                customers.map((c, idx) => (
                                    <motion.div
                                        key={c.id}
                                        variants={itemVariants}
                                        className="p-5 flex items-center justify-between hover:bg-white transition-all group border-l-4 border-l-transparent hover:border-l-blue-600"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xs group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                {c.customer_name?.charAt(0) || 'C'}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{c.customer_name || 'Anonymous'}</div>
                                                <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                                                    {c.customer_phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-black text-slate-300 uppercase tracking-tighter mb-1">{c.stores?.name}</div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold">{c.stores?.business_type}</span>
                                                <span className="text-[9px] px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-md font-bold">{c.stores?.address?.split(' ')[0]}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* Right: Message Editor */}
                <div className="space-y-6">
                    <section className="glass-panel p-6 border-white/60 shadow-xl h-full flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16 rounded-full"></div>

                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <MessageSquare className="text-blue-500" size={20} />
                            <h2 className="text-lg font-black text-slate-900">SMS Composer</h2>
                        </div>

                        <div className="flex-1 space-y-4 relative z-10">
                            <div className="bg-slate-950 rounded-[2rem] p-6 text-white min-h-[300px] shadow-2xl relative group">
                                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pointer-events-none rounded-b-[2rem]"></div>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="전송할 메시지 내용을 입력하세요... (고객명은 {name}으로 자동 치환됩니다)"
                                    className="w-full h-full bg-transparent border-none focus:ring-0 resize-none text-slate-200 font-medium placeholder:text-slate-700 leading-relaxed scrollbar-hide mb-12"
                                />
                                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${message.length > 80 ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            {message.length} <span className="text-slate-700">/ 80 CHARS (SMS)</span>
                                        </span>
                                    </div>
                                    {message.length > 80 && (
                                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Converting to LMS</span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Event Notice', text: '[WeMarket] 고객님, 특별 이벤트 소식이 있습니다! 금일 방문 시 10% 할인을 드립니다.' },
                                    { label: 'Store Promo', text: '[WeMarket] 새로운 메뉴 출시! 우리 동네 인기 매장에서 만나보세요.' }
                                ].map((tpl, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setMessage(tpl.text)}
                                        className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all text-left uppercase tracking-tight"
                                    >
                                        Template: {tpl.label}
                                    </button>
                                ))}
                            </div>

                            <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl flex gap-3 mt-4">
                                <AlertCircle className="text-blue-500 shrink-0" size={18} />
                                <p className="text-[10px] text-blue-700 font-medium leading-relaxed uppercase tracking-tighter">
                                    광고성 문자 전항 준수: (광고) 표시와 수신거부 번호가 자동으로 포함됩니다. 발송 비용은 매장별 정산 시 자동 차감됩니다.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleSend}
                            disabled={sending || targetCount === 0}
                            className={`w-full mt-8 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 ${sending || targetCount === 0
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                                }`}
                        >
                            {sending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Sending Job...
                                </>
                            ) : (
                                <>
                                    <Send size={18} />
                                    Launch Bulk SMS
                                </>
                            )}
                        </button>
                    </section>

                    {/* Send Status Card */}
                    <AnimatePresence>
                        {sendResult && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-emerald-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-emerald-500/20"
                            >
                                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-[40px]"></div>
                                <div className="relative z-10 text-center">
                                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30 backdrop-blur-md">
                                        <CheckCircle size={32} />
                                    </div>
                                    <h3 className="text-xl font-black mb-2 leading-tight">Batch Sent <br /> Successfully</h3>
                                    <p className="text-[11px] text-emerald-100 font-medium mb-6 uppercase tracking-widest">{sendResult.target_count}명에게 발송 시작됨</p>
                                    <button
                                        onClick={() => setSendResult(null)}
                                        className="w-full py-3 bg-emerald-900/40 hover:bg-emerald-900/60 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/20"
                                    >
                                        Close Notification
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
};

export default BulkSMSManager;
