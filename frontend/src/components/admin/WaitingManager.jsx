import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { getSocket, waitingAPI } from '../../api';
import {
  PhoneCall,
  Users,
  Clock,
  UserCheck,
  XCircle,
  RefreshCw,
  ListOrdered,
  Bell,
  Volume2,
  VolumeX,
  TrendingUp,
  BarChart2,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';

const STATUS_META = {
  waiting: { label: '대기 중', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  called: { label: '호출됨', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  entered: { label: '입장', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: '취소', badge: 'bg-gray-100 text-gray-500 border-gray-200' },
};

// 단순한 알림음 생성 (Web Audio API)
const playNotificationSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
        oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.15); // E5
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
    } catch {
        // 오디오 컨텍스트 실패 시 무시
    }
};

// 브라우저 알림 요청 및 발송
const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
};

const sendBrowserNotification = (title, body) => {
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico', tag: 'waiting-call' });
    }
};

// 평균 대기시간 계산 (분)
const calcAvgWaitMinutes = (entries) => {
    const completed = entries.filter(e => e.status === 'entered' && e.created_at && e.called_at);
    if (completed.length === 0) return 0;
    const total = completed.reduce((sum, e) => {
        const created = new Date(e.created_at).getTime();
        const called = new Date(e.called_at).getTime();
        return sum + Math.max(0, (called - created) / 60000);
    }, 0);
    return Math.round(total / completed.length);
};

// 오늘 호출→입장 완료 건수
const getTodayCompleted = (entries) => {
    const today = new Date().toDateString();
    return entries.filter(e => e.status === 'entered' && e.called_at && new Date(e.called_at).toDateString() === today).length;
};

// 알림톡 재발송 (기존 API 확장 필요 시)
const resendAlimtalk = async (waitingId, type) => {
    try {
        const res = await waitingAPI.resendNotification?.(waitingId, type);
        if (res?.success) toast.success(`${type === 'call' ? '호출' : '취소'} 알림톡을 재발송했습니다.`);
        else toast.error('알림톡 재발송에 실패했습니다.');
    } catch {
        toast.error('알림톡 재발송 중 오류가 발생했습니다.');
    }
};

const WaitingManager = () => {
    const { storeId } = useParams();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ACTIVE');
    const [refreshing, setRefreshing] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('waiting_sound') !== 'false');
    const [notificationEnabled, setNotificationEnabled] = useState(false);
    const fetchList = useCallback(async () => {
        try {
            const response = await waitingAPI.getStoreWaitingList(storeId);
            if (response.success) {
                setEntries(response.data || []);
            }
        } catch {
            toast.error('대기 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    const applyRemoteUpdate = useCallback((updated) => {
        setEntries(prev => {
            const exists = prev.some(e => e.id === updated.id);
            if (!exists) return prev;
            return prev.map(e => (e.id === updated.id ? { ...e, ...updated } : e));
        });
    }, []);

    // 알림 권한 초기화
    useEffect(() => {
        requestNotificationPermission().then(setNotificationEnabled);
    }, []);

    useEffect(() => {
        fetchList();

        const socket = getSocket();
        if (!socket) return undefined;

        socket.emit('join-store-waiting', { storeId: parseInt(storeId) });

        const handleListChanged = ({ storeId: sid }) => {
            if (parseInt(sid) === parseInt(storeId)) fetchList();
        };
        const handleRefreshAhead = () => fetchList();

        socket.on('waiting-list-changed', handleListChanged);
        socket.on('refresh-ahead-count', handleRefreshAhead);

        return () => {
            socket.off('waiting-list-changed', handleListChanged);
            socket.off('refresh-ahead-count', handleRefreshAhead);
        };
    }, [fetchList, storeId]);

    const handleStatus = async (id, status, label, entry) => {
        try {
            const res = await waitingAPI.updateStatus(id, status);
            if (res.success) {
                applyRemoteUpdate(res.data);
                toast.success(`${label} 처리되었습니다.`);

                // 호출(called) 시 알림음 + 브라우저 알림
                if (status === 'called' && soundEnabled) {
                    playNotificationSound();
                }
                if (status === 'called' && notificationEnabled) {
                    sendBrowserNotification(
                        '대기 호출',
                        `${entry?.customer_name || '고객'}님 #{entry?.queue_number}번 입장 안내`
                    );
                }
            }
        } catch {
            toast.error('대기 상태 변경에 실패했습니다.');
        }
    };

    const handleManualRefresh = async () => {
        setRefreshing(true);
        await fetchList();
        setRefreshing(false);
    };

    const handleResendNotification = async (id, type, entry) => {
        await resendAlimtalk(id, type);
        // 폴백: 소켓으로 직접 broadcast trigger
        const socket = getSocket();
        if (socket && type === 'call') {
            socket.emit('update-waiting-status', {
                storeId: parseInt(storeId),
                phone: entry?.customer_phone,
                status: 'called',
                entry: { ...entry, status: 'called' },
            });
        }
    };

    const filterByTab = (status) => {
        if (status === 'cancelled') return ['cancelled'];
        return ['waiting', 'called'].includes(status);
    };

    const visibleEntries = entries.filter(e => {
        if (activeTab === 'ALL') return true;
        if (activeTab === 'ACTIVE') return filterByTab(e.status);
        if (activeTab === 'ENTERED') return e.status === 'entered';
        if (activeTab === 'CANCELLED') return e.status === 'cancelled';
        return filterByTab(e.status);
    });

    const waitingCount = entries.filter(e => e.status === 'waiting').length;
    const calledCount = entries.filter(e => e.status === 'called').length;
    const todayCount = entries.filter(e => {
        if (!e.created_at) return false;
        return new Date(e.created_at).toDateString() === new Date().toDateString();
    }).length;
    const completedCount = getTodayCompleted(entries);
    const avgWaitMinutes = calcAvgWaitMinutes(entries);

    // 시간대별 등록 분포 (최근 24시간)
    const hourlyDistribution = Array.from({ length: 24 }, (_, h) => {
        const count = entries.filter(e => {
            if (!e.created_at) return false;
            return new Date(e.created_at).getHours() === h;
        }).length;
        return { hour: h, count };
    });

    const tabs = [
        { id: 'ACTIVE', label: '대기/호출' },
        { id: 'ENTERED', label: '입장' },
        { id: 'CANCELLED', label: '취소' },
        { id: 'ALL', label: '전체' },
    ];

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Users className="text-blue-400" size={32} />
                        스마트 대기 관리
                    </h1>
                    <p className="mt-2 text-slate-400">
                        웨이팅 등록 현황을 실시간으로 확인하고 호출·입장·취소를 처리하세요.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={soundEnabled}
                            onChange={e => { setSoundEnabled(e.target.checked); localStorage.setItem('waiting_sound', e.target.checked.toString()); }}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="flex items-center gap-1">
                            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                            호출 알림음
                        </span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={notificationEnabled}
                            onChange={async e => {
                                const granted = await requestNotificationPermission();
                                setNotificationEnabled(granted);
                                if (!granted) e.target.checked = false;
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            disabled={Notification.permission === 'denied'}
                        />
                        <span className="flex items-center gap-1">
                            <Bell size={16} />
                            브라우저 알림
                        </span>
                    </label>
                    <button
                        onClick={handleManualRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </div>

            {/* 현황 요약 - 5개 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                    icon={<ListOrdered size={24} />}
                    iconBg="bg-amber-100"
                    iconColor="text-amber-600"
                    label="현재 대기"
                    value={`${waitingCount}팀`}
                    trend={<TrendingUp size={14} className="text-amber-500" />}
                />
                <StatCard
                    icon={<PhoneCall size={24} />}
                    iconBg="bg-blue-100"
                    iconColor="text-blue-600"
                    label="호출 대기"
                    value={`${calledCount}팀`}
                />
                <StatCard
                    icon={<Clock size={24} />}
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                    label="오늘 등록"
                    value={`${todayCount}건`}
                />
                <StatCard
                    icon={<UserCheck size={24} />}
                    iconBg="bg-purple-100"
                    iconColor="text-purple-600"
                    label="오늘 입장"
                    value={`${completedCount}건`}
                />
                <StatCard
                    icon={<Clock size={24} />}
                    iconBg="bg-indigo-100"
                    iconColor="text-indigo-600"
                    label="평균 대기"
                    value={`${avgWaitMinutes}분`}
                    sub={avgWaitMinutes > 0 ? '호출→입장 기준' : '데이터 없음'}
                />
            </div>

            {/* 시간대별 분포 미니 차트 */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <BarChart2 className="text-blue-500" size={20} />
                        시간대별 웨이팅 등록 분포 (최근 데이터)
                    </h3>
                </div>
                <div className="flex items-end gap-1 h-32 overflow-x-auto pb-2 no-scrollbar">
                    {hourlyDistribution.map((d, i) => {
                        const maxCount = Math.max(...hourlyDistribution.map(x => x.count), 1);
                        const height = Math.max(4, (d.count / maxCount) * 100);
                        return (
                            <div key={i} className="flex flex-col items-center flex-1 min-w-[28px]" title={`${d.hour}시: ${d.count}건`}>
                                <div className="w-full bg-blue-100 rounded-t transition-all duration-300" style={{ height: `${height}%` }} />
                                <span className="text-[10px] text-gray-400 mt-1">{d.hour}시</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 탭 */}
            <div className="flex gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 대기 목록 */}
            {visibleEntries.length === 0 ? (
                <EmptyState
                    icon={<Users className="w-14 h-14 text-gray-300" />}
                    title="대기 중인 고객이 없습니다"
                    description="고객이 QR 코드로 웨이팅을 등록하면 실시간으로 표시됩니다."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleEntries.map((e) => {
                        const meta = STATUS_META[e.status] || STATUS_META.waiting;
                        const waitedMinutes = e.created_at
                            ? Math.max(0, Math.floor((Date.now() - new Date(e.created_at).getTime()) / 60000))
                            : 0;
                        const isCalled = e.status === 'called';
                        const isWaiting = e.status === 'waiting';
                        return (
                            <WaitingCard
                                key={e.id}
                                entry={e}
                                meta={meta}
                                waitedMinutes={waitedMinutes}
                                isCalled={isCalled}
                                isWaiting={isWaiting}
                                onCall={() => handleStatus(e.id, 'called', '호출', e)}
                                onEnter={() => handleStatus(e.id, 'entered', '입장', e)}
                                onCancel={() => handleStatus(e.id, 'cancelled', '취소', e)}
                                onResendCall={() => handleResendNotification(e.id, 'call', e)}
                                onResendCancel={() => handleResendNotification(e.id, 'cancel', e)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// 통계 카드 컴포넌트
const StatCard = ({ icon, iconBg, iconColor, label, value, trend, sub }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
                <span className={iconColor}>{icon}</span>
            </div>
        </div>
        <div>
            <p className="text-xs font-bold text-gray-400">{label}</p>
            <p className="text-2xl font-black text-gray-800">{value}</p>
            {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {trend && <div className="flex justify-end mt-2">{trend}</div>}
    </div>
);

// 대기 카드 컴포넌트
const WaitingCard = ({
    entry, meta, waitedMinutes, isCalled, isWaiting,
    onCall, onEnter, onCancel, onResendCall, onResendCancel,
}) => (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    <span className="text-lg font-black text-slate-700">#{entry.queue_number}</span>
                </div>
                <div>
                    <p className="font-bold text-gray-800">{entry.customer_name || '이름 없음'}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Users size={12} /> {entry.party_size}명 ·{' '}
                        <PhoneCall size={12} /> {entry.customer_phone}
                    </p>
                </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.className}`}>
                {meta.label}
            </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock size={12} />
            {entry.created_at
                ? `${new Date(entry.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 등록`
                : '시간 정보 없음'}
            {isWaiting && <span>· {waitedMinutes}분 대기</span>}
            {entry.called_at && <span>· 호출: {new Date(entry.called_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>

        {/* 액션 버튼들 */}
        {isWaiting && (
            <div className="grid grid-cols-2 gap-2 mt-auto">
                <button
                    onClick={onCall}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors"
                >
                    <PhoneCall size={15} /> 호출
                </button>
                <button
                    onClick={onCancel}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold transition-colors"
                >
                    <XCircle size={15} /> 취소
                </button>
            </div>
        )}

        {isCalled && (
            <div className="space-y-2 mt-auto">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onEnter}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors"
                    >
                        <UserCheck size={15} /> 입장 완료
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold transition-colors"
                    >
                        <XCircle size={15} /> 취소
                    </button>
                </div>
                {/* 재발송 버튼들 */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onResendCall}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition-colors"
                    >
                        <Send size={14} /> 호출 재발송
                    </button>
                    <button
                        onClick={onResendCancel}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                    >
                        <AlertTriangle size={14} /> 취소 재발송
                    </button>
                </div>
            </div>
        )}
    </div>
);

export default WaitingManager;