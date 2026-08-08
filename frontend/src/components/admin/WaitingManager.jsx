import { useState, useEffect, useCallback } from 'react';
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

const WaitingManager = () => {
    const { storeId } = useParams();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ACTIVE');
    const [refreshing, setRefreshing] = useState(false);

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
        // REST/socket 어느 쪽에서 도착하더라도 목록의 해당 항목을 갱신한다.
        setEntries(prev => {
            const exists = prev.some(e => e.id === updated.id);
            if (!exists) return prev;
            return prev.map(e => (e.id === updated.id ? { ...e, ...updated } : e));
        });
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

    const handleStatus = async (id, status, label) => {
        try {
            const res = await waitingAPI.updateStatus(id, status);
            if (res.success) {
                applyRemoteUpdate(res.data);
                toast.success(`${label} 처리되었습니다.`);
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
        const d = new Date(e.created_at);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    }).length;

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
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Users className="text-blue-400" size={32} />
                        스마트 대기 관리
                    </h1>
                    <p className="mt-2 text-slate-400">
                        웨이팅 등록 현황을 실시간으로 확인하고 호출·입장·취소를 처리하세요.
                    </p>
                </div>
                <button
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    새로고침
                </button>
            </div>

            {/* 현황 요약 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                        <ListOrdered className="text-amber-600" size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400">현재 대기 팀</p>
                        <p className="text-2xl font-black text-gray-800">{waitingCount}팀</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                        <PhoneCall className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400">호출 대기</p>
                        <p className="text-2xl font-black text-gray-800">{calledCount}팀</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <Clock className="text-emerald-600" size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400">오늘 등록</p>
                        <p className="text-2xl font-black text-gray-800">{todayCount}건</p>
                    </div>
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
                        return (
                            <div key={e.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                                            <span className="text-lg font-black text-slate-700">#{e.queue_number}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800">{e.customer_name || '이름 없음'}</p>
                                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                                <Users size={12} /> {e.party_size}명 ·{' '}
                                                <PhoneCall size={12} /> {e.customer_phone}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.className}`}>
                                        {meta.label}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Clock size={12} />
                                    {e.created_at
                                        ? `${new Date(e.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 등록`
                                        : '시간 정보 없음'}
                                    {e.status === 'waiting' && <span>· {waitedMinutes}분 대기</span>}
                                </div>

                                {activeTab !== 'CANCELLED' && e.status === 'waiting' && (
                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                        <button
                                            onClick={() => handleStatus(e.id, 'called', '호출')}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors"
                                        >
                                            <PhoneCall size={15} /> 호출
                                        </button>
                                        <button
                                            onClick={() => handleStatus(e.id, 'cancelled', '취소')}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold transition-colors"
                                        >
                                            <XCircle size={15} /> 취소
                                        </button>
                                    </div>
                                )}

                                {e.status === 'called' && (
                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                        <button
                                            onClick={() => handleStatus(e.id, 'entered', '입장')}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors"
                                        >
                                            <UserCheck size={15} /> 입장 완료
                                        </button>
                                        <button
                                            onClick={() => handleStatus(e.id, 'cancelled', '취소')}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold transition-colors"
                                        >
                                            <XCircle size={15} /> 취소
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WaitingManager;