import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { adminAPI } from '../../api';
import {
    Calendar, CreditCard, Download, TrendingUp,
    AlertCircle, CheckCircle2, DollarSign, Calculator, ChevronRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import { formatPrice } from '../../utils/format';

const SettlementManager = () => {
    const { storeId } = useParams();
    const [settlements, setSettlements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGenerate, setShowGenerate] = useState(false);
    const [period, setPeriod] = useState({ start: '', end: '' });

    useEffect(() => {
        fetchSettlements();
    }, [storeId]);

    const fetchSettlements = async () => {
        try {
            const res = await adminAPI.getSettlements(storeId);
            setSettlements(res.data || res);
        } catch (error) {
            toast.error('정산 내역을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!period.start || !period.end) {
            toast.warn('시작일과 종료일을 입력해주세요.');
            return;
        }
        try {
            await adminAPI.generateSettlement(storeId, {
                period_start: period.start,
                period_end: period.end
            });
            toast.success('신규 정산 데이터가 생성되었습니다.');
            setShowGenerate(false);
            fetchSettlements();
        } catch (error) {
            toast.error('정산 생성에 실패했습니다.');
        }
    };


    if (loading) return <div className="p-10 text-center text-gray-400">자금을 집계하는 중...</div>;

    return (
        <div className="max-w-6xl mx-auto p-6 max-h-[calc(100vh-80px)] overflow-y-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <DollarSign className="text-emerald-500" /> 정산 관리 시스템
                    </h1>
                    <p className="text-gray-500 mt-1">매출액에서 수수료와 부가세를 제외한 최종 입금액을 관리합니다.</p>
                </div>
                <button
                    onClick={() => setShowGenerate(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all"
                >
                    <Calculator size={20} /> 정산 데이터 생성
                </button>
            </div>

            {/* 정산 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                            <TrendingUp />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">누적 정산액</p>
                            <h4 className="text-xl font-black">{formatPrice(settlements.reduce((acc, cur) => acc + (cur.net_amount || 0), 0), true)}</h4>
                        </div>
                    </div>
                    <div className="text-xs text-gray-400">정산 완료된 전체 금액입니다.</div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                            <CreditCard />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">다음 정산 예정</p>
                            <h4 className="text-xl font-black text-blue-600">D-3 (목요일)</h4>
                        </div>
                    </div>
                    <div className="text-xs text-blue-400 font-medium cursor-pointer flex items-center gap-1">정산 주기 안내 <ChevronRight size={14} /></div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-amber-400">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                            <AlertCircle />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">지급 대기중</p>
                            <h4 className="text-xl font-black text-amber-600">{settlements.filter(s => s.status === 'PENDING').length}건</h4>
                        </div>
                    </div>
                    <div className="text-xs text-amber-600 font-medium">관리자 확인 프로세스 진행 중</div>
                </div>
            </div>

            {/* 정산 생성 모달 */}
            {showGenerate && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl scale-in-center">
                        <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                            <Calculator className="text-emerald-500" /> 신규 정산 합산
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">시적일</label>
                                <input
                                    type="date"
                                    value={period.start}
                                    onChange={e => setPeriod({ ...period, start: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">종료일</label>
                                <input
                                    type="date"
                                    value={period.end}
                                    onChange={e => setPeriod({ ...period, end: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowGenerate(false)}
                                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleGenerate}
                                className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
                            >
                                집계 시작
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 정산 목록 테이블 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">정산 대상 기간</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">총 매출액</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">공제액 (수수료/환불)</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">실 지급액</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">상태</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">액션</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {settlements.map((s) => (
                                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-100 rounded-lg text-gray-500"><Calendar size={16} /></div>
                                            <div>
                                                <div className="font-bold text-gray-900">{s.period_start} ~ {s.period_end}</div>
                                                <div className="text-[10px] text-gray-400">집계일: {new Date(s.created_at).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right font-medium text-gray-900">{formatPrice(s.total_sales, true)}</td>
                                    <td className="px-6 py-5 text-right font-medium text-red-500">-{formatPrice(s.total_refunds + s.commission_amount + s.vat_amount, true)}</td>
                                    <td className="px-6 py-5 text-right font-black text-indigo-600 underline underline-offset-4 decoration-indigo-200 decoration-2">{formatPrice(s.net_amount, true)}</td>
                                    <td className="px-6 py-5">
                                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${s.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {s.status === 'COMPLETED' ? <CheckCircle2 size={12} /> : <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                                            {s.status === 'COMPLETED' ? '지급완료' : '지급대기'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <button className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="상세 명세서 다운로드">
                                            <Download size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {settlements.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center text-gray-400">정산 데이터가 없습니다. 상단의 버튼을 눌러 집계를 시작하세요.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SettlementManager;
