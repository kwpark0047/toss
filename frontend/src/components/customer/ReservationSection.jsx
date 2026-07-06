import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, ChevronRight, CheckCircle2, AlertCircle, Phone, Search, XCircle } from 'lucide-react';
import { reservationsAPI } from '../../api';

const ReservationSection = ({ storeId }) => {
    const [activeTab, setActiveTab] = useState('register'); // 'register' | 'track'
    const [step, setStep] = useState('form'); // 'form' | 'success' | 'error'
    const [loading, setLoading] = useState(false);

    // 예약 신청용 State
    const [formData, setFormData] = useState({
        customer_name: '',
        customer_phone: '',
        party_size: 2,
        reservation_date: new Date().toISOString().split('T')[0],
        reservation_time: '18:00',
        notes: ''
    });

    // 예약 조회용 State
    const [searchPhone, setSearchPhone] = useState('');
    const [myReservations, setMyReservations] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);

    // 컴포넌트 마운트 시 로컬스토리지에서 최근 사용한 번호 불러오기
    useEffect(() => {
        const savedPhone = localStorage.getItem('reservation_phone');
        if (savedPhone) {
            setSearchPhone(savedPhone);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const reservation_time = `${formData.reservation_date}T${formData.reservation_time}:00`;
            const response = await reservationsAPI.register({
                store_id: storeId,
                ...formData,
                reservation_time
            });
            if (response.data.success) {
                localStorage.setItem('reservation_phone', formData.customer_phone);
                setStep('success');
            } else {
                setStep('error');
            }
        } catch (error) {
            console.error('Reservation failed:', error);
            setStep('error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e?.preventDefault();
        if (!searchPhone) return alert('연락처를 입력해주세요.');
        setLoading(true);
        try {
            const response = await reservationsAPI.getMyReservations(searchPhone);
            if (response.data?.success) {
                // 현재 매장에 해당하는 예약만 필터링
                const storeReservations = response.data.data.filter(r => r.store_id === storeId);
                setMyReservations(storeReservations);
                localStorage.setItem('reservation_phone', searchPhone);
            }
        } catch {
            alert('예약 내역을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
            setHasSearched(true);
        }
    };

    const handleCancel = async (reservationId) => {
        if (!window.confirm('정말 이 예약을 취소하시겠습니까?')) return;
        setLoading(true);
        try {
            const response = await reservationsAPI.cancel(reservationId, searchPhone);
            if (response.data?.success) {
                alert('예약이 정상적으로 취소되었습니다.');
                handleSearch(); // 목록 갱신
            }
        } catch (error) {
            alert(error.response?.data?.error || '예약 취소에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'success') {
        return (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="text-green-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">예약 신청 완료!</h3>
                <p className="text-gray-600 mb-6">
                    매장에서 확인 후 확정 안내 문자를 보내드립니다.<br />
                    잠시만 기다려 주세요.
                </p>
                <button
                    onClick={() => setStep('form')}
                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                    확인
                </button>
            </div>
        );
    }

    if (step === 'error') {
        return (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="text-red-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">오류 발생</h3>
                <p className="text-gray-600 mb-6">
                    예약 처리 중 오류가 발생했습니다.<br />
                    다시 시도하거나 매장으로 문의해 주세요.
                </p>
                <button
                    onClick={() => setStep('form')}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                >
                    다시 시도
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 탭 네비게이션 */}
            <div className="flex border-b border-gray-100">
                <button
                    onClick={() => { setActiveTab('register'); setStep('form'); }}
                    className={`flex-1 py-4 font-bold text-sm transition-colors ${activeTab === 'register' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    예약 신청
                </button>
                <button
                    onClick={() => setActiveTab('track')}
                    className={`flex-1 py-4 font-bold text-sm transition-colors ${activeTab === 'track' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    예약 확인/취소
                </button>
            </div>

            {/* 내용 렌더링 영역 */}
            {activeTab === 'register' ? (
                <>
                    <div className="p-6 border-b border-gray-50">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Calendar className="text-blue-600" size={20} />
                            스마트 예약 신청
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">원하시는 예약 날짜와 정보를 정확히 입력해주세요.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-gray-50/30">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 ml-1">날짜</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        required
                                        value={formData.reservation_date}
                                        onChange={(e) => setFormData({ ...formData, reservation_date: e.target.value })}
                                        className="w-full pl-3 pr-3 py-3 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 ml-1">시간</label>
                                <div className="relative">
                                    <input
                                        type="time"
                                        required
                                        value={formData.reservation_time}
                                        onChange={(e) => setFormData({ ...formData, reservation_time: e.target.value })}
                                        className="w-full pl-3 pr-3 py-3 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 ml-1">예약 인원</label>
                            <div className="flex items-center gap-2">
                                {[2, 3, 4, 5, 6].map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, party_size: num })}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${formData.party_size === num
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        {num === 6 ? '6명+' : `${num}명`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 ml-1">예약자 성함</label>
                            <input
                                type="text"
                                required
                                placeholder="이름을 입력하세요"
                                value={formData.customer_name}
                                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 ml-1">연락처</label>
                            <input
                                type="tel"
                                required
                                placeholder="010-0000-0000"
                                value={formData.customer_phone}
                                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                            />
                            <p className="text-xs text-gray-400 text-center">🔒 AES-256 암호화 저장</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-500 ml-1">요청 사항 (선택)</label>
                            <textarea
                                placeholder="알레르기 정보나 특별한 요청사항이 있다면 적어주세요."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all resize-none h-20"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all mt-4 disabled:opacity-50"
                        >
                            {loading ? '처리 중...' : '예약 신청하기'}
                            {!loading && <ChevronRight size={18} />}
                        </button>
                    </form>
                </>
            ) : (
                <div className="p-6 space-y-6">
                    <form onSubmit={handleSearch} className="space-y-3">
                        <label className="text-sm font-bold text-gray-900 block">예약하신 휴대폰 번호를 입력해주세요</label>
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="tel"
                                required
                                placeholder="010-0000-0000"
                                value={searchPhone}
                                onChange={(e) => setSearchPhone(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50"
                        >
                            <Search size={18} /> 조회하기
                        </button>
                    </form>

                    {hasSearched && (
                        <div className="pt-6 border-t border-gray-100">
                            <h4 className="text-sm font-black text-gray-900 mb-4">나의 예약 현황</h4>
                            {myReservations.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                                    진행 중인 예약이 없습니다.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {myReservations.map(res => (
                                        <div key={res.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase ${res.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                                    res.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {res.status === 'PENDING' ? '승인 대기 중' : '예약 확정'}
                                                </span>
                                            </div>

                                            <div className="space-y-2 mb-6">
                                                <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                                                    <Clock size={16} className="text-blue-500" />
                                                    {new Date(res.reservation_time).toLocaleString('ko-KR', {
                                                        month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                                                    <Users size={16} className="text-orange-500" />
                                                    {res.party_size}명
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleCancel(res.id)}
                                                disabled={loading}
                                                className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                                            >
                                                <XCircle size={16} /> 이 예약 취소하기
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReservationSection;
