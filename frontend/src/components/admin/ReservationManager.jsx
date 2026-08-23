import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import { getSocket, reservationsAPI } from '../../api';
import { toast } from 'react-toastify';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import Icon from '../ui/Icon';

const ReservationManager = () => {
    const { storeId } = useParams();
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState('ALL');

    const fetchReservations = useCallback(async () => {
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const response = await reservationsAPI.getByStore(storeId, { date: dateStr });
            if (response.success) {
                setReservations(response.data);
            }
        } catch {
            toast.error('예약 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, [storeId, selectedDate]);

    useEffect(() => {
        fetchReservations();

        const socket = getSocket();
        if (socket) {
            socket.on('new-reservation', (newRes) => {
                if (newRes.store_id === parseInt(storeId)) {
                    setReservations(prev => {
                        // 중복 방지 로직 향상
                        if (prev.find(r => r.id === newRes.id)) return prev;
                        return [newRes, ...prev];
                    });
                    toast.info('새로운 예약 신청이 도착했습니다!');
                }
            });
        }

        return () => {
            if (socket) {
                socket.off('new-reservation');
            }
        };
    }, [storeId, fetchReservations]);

    const handleStatusUpdate = async (id, status) => {
        try {
            const response = await reservationsAPI.updateStatus(id, status);
            if (response.success) {
                setReservations(prev => prev.map(res => res.id === id ? { ...res, status } : res));
                toast.success('예약 상태가 변경되었습니다.');
            }
        } catch {
            toast.error('상태 변경에 실패했습니다.');
        }
    };

    const changeDate = (days) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
    };

    const tabs = [
        { id: 'ALL', label: '전체' },
        { id: 'PENDING', label: '대기 중' },
        { id: 'CONFIRMED', label: '승인됨' },
        { id: 'COMPLETED', label: '방문 완료' },
        { id: 'NOSHOW', label: '노쇼' },
        { id: 'CANCELED', label: '취소/거절' },
    ];

    const filteredReservations = reservations.filter(res => {
        if (activeTab === 'ALL') return true;
        if (activeTab === 'CANCELED') return ['CANCELED', 'REJECTED'].includes(res.status);
        return res.status === activeTab;
    });

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <CalendarCheck className="text-blue-400" size={32} />
                        스마트 예약 관리
                    </h1>
                    <p className="mt-2 text-slate-400">고객의 예약 접수 현황을 확인하고 관리하세요.</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                {/* 탭 네비게이션 */}
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
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
                            {tab.id !== 'ALL' && (
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                                    }`}>
                                    {reservations.filter(r => r.status === tab.id).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* 날짜 선택 컨트롤러 */}
                <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl shrink-0">
                    <button
                        onClick={() => changeDate(-1)}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-500 hover:text-blue-600 transition-colors"
                    >
                        &lt;
                    </button>
                    <div className="font-black text-gray-800 flex items-center gap-2 px-2">
                        <CalendarCheck size={18} className="text-blue-500" />
                        {selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                    </div>
                    <button
                        onClick={() => changeDate(1)}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-500 hover:text-blue-600 transition-colors"
                    >
                        &gt;
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReservations.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl border border-gray-100">
                        <EmptyState icon="📅" title="예약이 없습니다" description="선택한 날짜 및 조건에 해당하는 예약이 없습니다." />
                    </div>
                ) : (
                    filteredReservations.map(res => (
                        <div key={res.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-blue-100 transition-colors hover:shadow-md">
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase shadow-sm ${res.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                    res.status === 'CONFIRMED' ? 'bg-green-100 text-green-700 border border-green-200' :
                                        res.status === 'REJECTED' ? 'bg-red-100 text-red-700 border border-red-200' :
                                            res.status === 'CANCELED' ? 'bg-gray-100 text-gray-600 border border-gray-300' :
                                                res.status === 'NOSHOW' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                                    'bg-gray-100 text-gray-700 border border-gray-200'
                                    }`}>
                                    {res.status === 'PENDING' ? '대기 중' :
                                        res.status === 'CONFIRMED' ? '승인됨 (예약)' :
                                            res.status === 'REJECTED' ? '거절됨' :
                                                res.status === 'CANCELED' ? '손님 취소' :
                                                    res.status === 'NOSHOW' ? '노쇼 (미방문)' : '방문 완료'}
                                </span>
                                <div className="text-right">
                                    <div className="text-sm font-black text-gray-900">{res.customer_name}</div>
                                    <div className="text-[11px] font-bold text-gray-400 flex items-center justify-end gap-1 mt-1 bg-gray-50 px-2 py-0.5 rounded-lg">
                                        <Phone size={10} /> {res.customer_phone}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-3 text-gray-700 bg-blue-50/30 p-3 rounded-xl text-sm border border-blue-50/50">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                        <Clock size={16} className="text-blue-600" />
                                    </div>
                                    <span className="font-black text-lg text-blue-900">
                                        {new Date(res.reservation_time).toLocaleTimeString('ko-KR', {
                                            hour: '2-digit', minute: '2-digit', hour12: false
                                        })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-700 bg-orange-50/30 p-3 rounded-xl text-sm border border-orange-50/50">
                                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                                        <Icon icon="Users" />
                                    </div>
                                    <span className="font-black text-orange-900">{res.party_size}명</span>
                                </div>
                                {res.notes && (
                                    <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-700 border border-gray-100 relative overflow-hidden">
                                        <div className="w-1 h-full bg-gray-300 absolute left-0 top-0"></div>
                                        <span className="font-black text-gray-400 block mb-1 text-[10px] uppercase tracking-wider">요청사항</span>
                                        <span className="font-medium">{res.notes}</span>
                                    </div>
                                )}
                            </div>

                            {res.status === 'PENDING' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleStatusUpdate(res.id, 'REJECTED')}
                                        className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors shadow-sm"
                                    >
                                        <XCircle size={18} /> 거절
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(res.id, 'CONFIRMED')}
                                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 active:scale-95"
                                    >
                                        <CheckCircle size={18} /> 예약 승인
                                    </button>
                                </div>
                            )}
                            {res.status === 'CONFIRMED' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleStatusUpdate(res.id, 'NOSHOW')}
                                        className="flex-[0.4] py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-sm"
                                    >
                                        노쇼 처리
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(res.id, 'COMPLETED')}
                                        className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black hover:bg-black transition-colors shadow-md shadow-slate-900/20 active:scale-95"
                                    >
                                        방문 완료 처리
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ReservationManager;
