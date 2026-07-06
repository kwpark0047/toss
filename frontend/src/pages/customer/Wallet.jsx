import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    Wallet as WalletIcon,
    History,
    Gift,
    ChevronLeft,
    QrCode,
    CreditCard,
    ArrowUpRight,
    ArrowDownLeft,
    Search,
    CheckCircle2,
    TrendingUp,
    TrendingDown,
    Zap,
    Trophy,
    User
} from "lucide-react";
import { motion } from "framer-motion";

const Wallet = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [phone, setPhone] = useState(searchParams.get("phone") || "");
    const [inputPhone, setInputPhone] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    // 포인트 정보 조회
    const fetchWalletData = async (targetPhone) => {
        setIsSearching(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const tossKey = searchParams.get("toss_user_key");
            const storeId = searchParams.get("store_id");

            const response = await axios.get(`${baseUrl}/api/points/wallet-lookup`, {
                params: {
                    phone: targetPhone,
                    toss_user_key: tossKey,
                    store_id: storeId
                }
            });
            setData(response.data);
            if (targetPhone) setPhone(targetPhone);
        } catch (error) {
            console.error("지갑 데이터 로딩 실패:", error);
        } finally {
            setIsSearching(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (phone || searchParams.get("toss_user_key")) {
            fetchWalletData(phone);
        } else {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePhoneSubmit = (e) => {
        e.preventDefault();
        if (inputPhone.length >= 10) {
            fetchWalletData(inputPhone);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // 조회가 필요한 경우 (입력창 표시)
    if (!data && !phone) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-100">
                    <WalletIcon className="text-white" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">모바일 멤버십 월렛</h1>
                <p className="text-slate-500 text-center mb-8">휴대폰 번호를 입력하면<br />적립된 포인트와 스탬프를 확인하실 수 있습니다.</p>

                <form onSubmit={handlePhoneSubmit} className="w-full max-w-sm">
                    <div className="relative mb-4">
                        <input
                            type="tel"
                            value={inputPhone}
                            onChange={(e) => setInputPhone(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="010-1234-5678"
                            className="w-full h-14 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl text-lg font-medium focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    </div>
                    <button
                        type="submit"
                        disabled={isSearching || inputPhone.length < 10}
                        className="w-full h-14 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 disabled:opacity-50 active:scale-95 transition-all"
                    >
                        {isSearching ? "조회 중..." : "지갑 열기"}
                    </button>
                </form>
            </div>
        );
    }

    const { balance, history, store_settings } = data || {};

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* 헤더 */}
            <div className="bg-white px-4 py-4 flex items-center justify-between border-b sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-600">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-lg font-bold text-slate-900">내 멤버십 지갑</h1>
                <button className="p-2 -mr-2 text-slate-600">
                    <QrCode size={24} />
                </button>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 space-y-8"
            >
                {/* 프리미엄 멤버십 카드 (Glossy Effect) */}
                <motion.div
                    whileHover={{ scale: 1.02, rotateY: 5, rotateX: -5 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative aspect-[1.6/1] rounded-[2.5rem] p-8 text-white shadow-2xl overflow-hidden group perspective-1000"
                    style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}
                >
                    {/* 광택 및 무늬 레이어 */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay" />
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/20 rounded-full blur-3xl group-hover:translate-x-10 group-hover:-translate-y-10 transition-transform duration-1000" />
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl" />

                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center shadow-inner">
                                    <Zap size={24} className="text-yellow-300 fill-yellow-300" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100/60 leading-none mb-1">Elite Membership</p>
                                    <p className="font-black text-lg tracking-tight leading-none">WeMarket <span className="text-indigo-200/80">Premium</span></p>
                                </div>
                            </div>
                            <Trophy size={28} className="text-yellow-400/50" />
                        </div>

                        <div>
                            <p className="text-indigo-100/60 text-[10px] font-black uppercase tracking-[0.2em] mb-1.5">Available Reward Points</p>
                            <div className="flex items-baseline gap-2">
                                <motion.h2
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-5xl font-black tracking-tighter"
                                >
                                    {(balance?.total_points || 0).toLocaleString()}
                                </motion.h2>
                                <span className="text-2xl font-black text-indigo-200">P</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-end border-t border-white/10 pt-6 mt-4">
                            <div className="space-y-1">
                                <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em]">Member ID</p>
                                <p className="font-mono font-bold text-xs tracking-widest text-indigo-100">
                                    {phone ? phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3') : 'TOSS-VERIFIED-USER'}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="px-3 py-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 스탬프 현황 (Glassmorphism) */}
                {store_settings?.use_points && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-panel p-8"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-black text-slate-900 tracking-tight flex items-center gap-2 text-lg">
                                <Star className="text-orange-500 fill-orange-500" size={20} /> 스탬프 혜택 현황
                            </h3>
                            <div className="px-4 py-1.5 rounded-2xl bg-orange-500 text-white font-black text-[10px] shadow-lg shadow-orange-100">
                                {store_settings.earn_rate}% 적립
                            </div>
                        </div>
                        <div className="grid grid-cols-5 gap-4">
                            {[...Array(10)].map((_, i) => {
                                const isEarned = (balance?.total_points / 1000) > i;
                                return (
                                    <motion.div
                                        key={i}
                                        whileHover={isEarned ? { scale: 1.1, rotate: 5 } : {}}
                                        className={`aspect-square rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${isEarned
                                            ? 'bg-orange-500 border-orange-400 shadow-xl shadow-orange-100'
                                            : 'bg-slate-50 border-slate-100 border-dashed'
                                            }`}
                                    >
                                        {isEarned ? (
                                            <Trophy size={20} className="text-white fill-white/20" />
                                        ) : (
                                            <span className="text-slate-200 font-black text-sm">{i + 1}</span>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                        <p className="mt-6 text-xs text-slate-400 text-center font-bold tracking-tight">
                            1,000 포인트마다 <span className="text-orange-600">특별한 선물</span>이 쏟아져요! 🎁
                        </p>
                    </motion.div>
                )}

                {/* 최근 거래 내역 (Premium List) */}
                <div className="space-y-5">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="font-black text-slate-900 tracking-tight flex items-center gap-2.5 text-lg">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                <History size={16} />
                            </div>
                            최근 이용 내역
                        </h3>
                        <button className="text-xs font-black text-blue-600">전체보기</button>
                    </div>

                    <div className="glass-panel overflow-hidden">
                        {history?.length > 0 ? (
                            <div className="divide-y divide-slate-100/50">
                                {history.map((tx, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors group active:bg-slate-100"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center shadow-inner ${tx.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                                }`}>
                                                {tx.amount > 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 tracking-tight">{tx.description || (tx.amount > 0 ? '포인트 적립' : '포인트 사용')}</p>
                                                <p className="text-[11px] text-slate-400 mt-1 font-bold font-mono">
                                                    {new Date(tx.created_at).toLocaleDateString()} <span className="mx-1.5 opacity-30">|</span> {tx.store_name || '위마켓 본점'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xl font-black tracking-tighter ${tx.amount > 0 ? 'text-emerald-600' : 'text-slate-950'}`}>
                                                {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                                            </p>
                                            <span className="text-[10px] font-black text-slate-300 uppercase">Points</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <History size={24} className="text-slate-200" />
                                </div>
                                <p className="text-slate-400 font-black text-sm tracking-tight">거래 내역이 아직 없네요</p>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* 바닥 유도 버튼 (A2HS) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t z-20">
                <button className="w-full h-14 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                    <QrCode size={20} /> 멤버십 카드 홈 화면에 추가
                </button>
            </div>
        </div>
    );
};

export default Wallet;
