import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { adminAPI, storesAPI } from '../../api'; // storesAPI 추가
import {
    Users, Search, Filter, TrendingUp, Calendar,
    Smartphone, User, ChevronRight, RefreshCw, Award, Send
} from 'lucide-react';
import { formatPrice } from '../../utils/format';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * [관리자용 단골고객 관리 컴포넌트]
 * 매장별 고객 리스트, 방문 횟수, 총 결제 금액 등 통계 정보를 제공합니다.
 */
const CustomerManager = () => {
    const { storeId } = useParams();
    const [customers, setCustomers] = useState([]);
    const [storeInfo, setStoreInfo] = useState(null); // 매장 정보 상태 추가
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('last_visit_at');
    const [order, setOrder] = useState('desc');

    // 매장 정보 로드
    const fetchStoreInfo = useCallback(async () => {
        try {
            const res = await storesAPI.getById(storeId);
            setStoreInfo(res.data);
        } catch (err) {
            console.error('매장 정보 로드 실패:', err);
        }
    }, [storeId]);

    // 고객 목록 로드
    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/customers/${storeId}?sortBy=${sortBy}&order=${order}&search=${searchTerm}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const result = await res.json();
            if (result.success) {
                setCustomers(result.data);
            }
        } catch (err) {
            console.error('단골고객 로드 실패:', err);
        } finally {
            setLoading(false);
        }
    }, [storeId, sortBy, order, searchTerm]);

    useEffect(() => {
        fetchStoreInfo();
        fetchCustomers();
    }, [fetchStoreInfo, fetchCustomers]);

    // 날짜 포맷팅 유틸리티
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* 1. 헤더 영역 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
                        <Users className="w-8 h-8 text-primary-500" />
                        단골고객 관리
                    </h1>
                    <p className="text-navy-500">우리 매장을 방문한 소중한 고객님들의 정보를 확인하세요.</p>
                </div>
                <button
                    onClick={fetchCustomers}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-navy-200 rounded-xl text-navy-600 hover:bg-navy-50 transition-all shadow-soft"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    새로고침
                </button>
            </div>

            {/* 2. 필터 및 검색 바 */}
            <div className="bg-white p-4 rounded-2xl shadow-soft border border-navy-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400" />
                    <input
                        type="text"
                        placeholder="고객명 또는 휴대폰 번호 검색..."
                        className="w-full pl-12 pr-4 py-3 bg-navy-50 rounded-xl border-none focus:ring-2 focus:ring-primary-500 outline-none transition-all text-navy-900"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="px-4 py-3 bg-navy-50 rounded-xl border-none focus:ring-2 focus:ring-primary-500 outline-none text-navy-700 font-medium"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="last_visit_at">최근 방문순</option>
                        <option value="visit_count">방문 횟수순</option>
                        <option value="total_spent">총 결제 금액순</option>
                        <option value="created_at">최초 등록순</option>
                    </select>
                    <button
                        onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
                        className="px-4 py-3 bg-navy-50 rounded-xl text-navy-700 hover:bg-navy-100 transition-all font-medium"
                    >
                        {order === 'desc' ? '내림차순' : '오름차순'}
                    </button>
                </div>
            </div>

            {/* 3. 고객 리스트 카드/테이블 */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-soft border border-navy-100">
                    <RefreshCw className="w-10 h-10 text-primary-500 animate-spin mb-4" />
                    <p className="text-navy-500 animate-pulse">고객 데이터를 불러오는 중입니다...</p>
                </div>
            ) : customers.length === 0 ? (
                <div className="py-20 bg-white rounded-2xl shadow-soft border border-navy-100 text-center">
                    <User className="w-16 h-16 text-navy-200 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-navy-900 mb-2">데이터가 없습니다</h3>
                    <p className="text-navy-500">아직 단골고객 데이터가 쌓이지 않았거나 조건에 맞는 고객이 없습니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {customers.map((customer) => (
                        <div key={customer.id} className="bg-white p-6 rounded-2xl shadow-soft border border-navy-100 hover:shadow-card transition-all group">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
                                        {customer.visit_count >= 10 ? <Award className="w-8 h-8" /> : <User className="w-8 h-8" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-navy-900 flex items-center gap-2">
                                            {customer.customer_name || '익명 고객'}
                                            {customer.visit_count >= 5 && (
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">VIP</span>
                                            )}
                                        </h3>
                                        <div className="flex items-center gap-2 text-navy-500 text-sm mt-1">
                                            <Smartphone className="w-3.5 h-3.5" />
                                            {customer.customer_phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3')}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-navy-400 mb-1">총 결제 금액</div>
                                    <div className="font-bold text-navy-900 text-xl">{formatPrice(customer.total_spent)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 mt-6">
                                <div className="bg-navy-50 p-3 rounded-xl text-center">
                                    <div className="text-xs text-navy-400 mb-1">방문 횟수</div>
                                    <div className="font-bold text-navy-900">{customer.visit_count}회</div>
                                </div>
                                <div className="col-span-2 bg-navy-50 p-3 rounded-xl px-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs text-navy-400 mb-1">최근 방문일</div>
                                        <div className="text-sm font-medium text-navy-800">{formatDate(customer.last_visit_at)}</div>
                                    </div>
                                    <TrendingUp className="w-5 h-5 text-primary-400" />
                                </div>
                                <motion.button
                                    whileHover={{ scale: storeInfo?.can_send_sms ? 1.05 : 1 }}
                                    whileTap={{ scale: storeInfo?.can_send_sms ? 0.95 : 1 }}
                                    onClick={() => {
                                        if (storeInfo?.can_send_sms) {
                                            alert(`${customer.customer_name || '고객'}님께 SMS 발송 화면으로 이동합니다.`);
                                        } else {
                                            alert('SMS 발송 권한이 없습니다. 최고관리자에게 문의하세요.');
                                        }
                                    }}
                                    className={`flex items-center justify-center rounded-xl transition-all ${storeInfo?.can_send_sms
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        }`}
                                    title={storeInfo?.can_send_sms ? "SMS 발송" : "권한 없음"}
                                >
                                    <Send size={20} />
                                </motion.button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomerManager;
