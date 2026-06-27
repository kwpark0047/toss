import { useState, useEffect, useCallback } from 'react';
import { staffRequestsAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ChefHat, CheckCircle, XCircle, Clock, Store, User, MessageSquare, Filter, Package } from 'lucide-react';

// super_admin용 스태프 계정 신청 관리 페이지
const StaffRequestsManage = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [filter, setFilter] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [adminNote, setAdminNote] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await staffRequestsAPI.getAll(filter === 'all' ? null : filter);
            setRequests(res.data || []);
        } catch (err) {
            console.error('Failed to fetch staff requests:', err);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleApprove = async (id) => {
        setProcessingId(id);
        try {
            await staffRequestsAPI.approve(id, adminNote);
            fetchRequests();
            setSelectedRequest(null);
            setAdminNote('');
        } catch (err) {
            alert(err.message || '승인 실패');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id) => {
        setProcessingId(id);
        try {
            await staffRequestsAPI.reject(id, adminNote);
            fetchRequests();
            setSelectedRequest(null);
            setAdminNote('');
        } catch (err) {
            alert(err.message || '거절 실패');
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved':
                return <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"><CheckCircle size={14} />승인</span>;
            case 'rejected':
                return <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"><XCircle size={14} />거절</span>;
            default:
                return <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm"><Clock size={14} />대기</span>;
        }
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'manager':
                return <span className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium"><Shield size={14} />매니저</span>;
            case 'kitchen':
                return <span className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-medium"><ChefHat size={14} />주방</span>;
            default:
                return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full font-medium capitalize">{role}</span>;
        }
    };

    // 권한 체크
    if (user?.role !== 'super_admin') {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Shield className="mx-auto mb-4 text-gray-300" size={48} />
                    <p className="text-gray-500">전체 관리자만 접근할 수 있습니다</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Shield className="text-blue-500" size={32} />
                    <h1 className="text-2xl font-bold text-navy-900">스태프 계정 신청 관리</h1>
                </div>

                {/* 필터 */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                    {['pending', 'approved', 'rejected', 'all'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-white shadow text-navy-900' : 'text-navy-500 hover:text-navy-700'
                                }`}
                        >
                            {f === 'pending' ? '대기' : f === 'approved' ? '승인' : f === 'rejected' ? '거절' : '전체'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-16">
                    <Filter className="mx-auto mb-4 text-gray-300" size={48} />
                    <p className="text-gray-500">
                        {filter === 'pending' ? '대기 중인 신청이 없습니다' : '해당 조건의 신청이 없습니다'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {requests.map((req) => (
                        <div
                            key={req.id}
                            className={`bg-white rounded-2xl border-2 transition-all ${selectedRequest?.id === req.id ? 'border-primary-500 shadow-lg' : 'border-gray-100 hover:border-gray-200'
                                }`}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                                            <Store className="text-white" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-navy-900">{req.store_name || `매장 #${req.store_id}`}</h3>
                                            <p className="text-sm text-navy-500 flex items-center gap-2 mt-1">
                                                <User size={14} />
                                                {req.user_name || req.user_email}
                                            </p>
                                        </div>
                                    </div>
                                    {getStatusBadge(req.status)}
                                </div>

                                <div className="flex items-center gap-4 mb-4">
                                    {getRoleBadge(req.role)}
                                    <span className="flex items-center gap-1 text-navy-900 font-bold">
                                        <Package size={14} /> {req.count}개
                                    </span>
                                </div>

                                {req.reason && (
                                    <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                                        <p className="text-sm text-navy-500 flex items-center gap-2 mb-1">
                                            <MessageSquare size={14} />신청 사유
                                        </p>
                                        <p className="text-sm text-navy-700">{req.reason}</p>
                                    </div>
                                )}

                                <p className="text-xs text-gray-400 mb-4">
                                    {new Date(req.created_at).toLocaleString('ko-KR')}
                                </p>

                                {req.status === 'pending' && (
                                    <div>
                                        {selectedRequest?.id === req.id ? (
                                            <div className="space-y-3">
                                                <textarea
                                                    value={adminNote}
                                                    onChange={(e) => setAdminNote(e.target.value)}
                                                    placeholder="관리자 메모 (선택)"
                                                    rows={2}
                                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl outline-none resize-none"
                                                />
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => handleApprove(req.id)}
                                                        disabled={processingId === req.id}
                                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 disabled:opacity-50"
                                                    >
                                                        <CheckCircle size={18} />
                                                        {processingId === req.id ? '처리 중...' : '승인'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(req.id)}
                                                        disabled={processingId === req.id}
                                                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-50"
                                                    >
                                                        <XCircle size={18} />
                                                        {processingId === req.id ? '처리 중...' : '거절'}
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelectedRequest(null); setAdminNote(''); }}
                                                        className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300"
                                                    >
                                                        취소
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setSelectedRequest(req)}
                                                className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600"
                                            >
                                                신청 검토하기
                                            </button>
                                        )}
                                    </div>
                                )}

                                {req.admin_note && req.status !== 'pending' && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                                        <p className="text-xs text-gray-500 mb-1">관리자 메모</p>
                                        <p className="text-sm text-navy-700">{req.admin_note}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StaffRequestsManage;
