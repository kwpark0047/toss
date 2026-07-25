import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { adminAPI } from '../../api';
import { formatPrice } from '../../utils/format';
import { Save, Type, Eye, CheckSquare, Square, Store } from 'lucide-react';
import { toast } from 'react-toastify';

const ReceiptSettings = () => {
    const { storeId } = useParams();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, [storeId]);

    const fetchSettings = async () => {
        try {
            const res = await adminAPI.getReceiptSettings(storeId);
            setSettings(res.data || res); // 응답 형식에 따라 조정
        } catch {
            toast.error('설정을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        setSaving(true);
        try {
            await adminAPI.updateReceiptSettings(storeId, settings);
            toast.success('영수증 설정이 저장되었습니다.');
        } catch {
            toast.error('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const toggleField = (field) => {
        setSettings(prev => ({ ...prev, [field]: prev[field] ? 0 : 1 }));
    };

    if (loading) return <div className="p-10 text-center">로딩 중...</div>;

    return (
        <div className="max-w-6xl mx-auto p-6 max-h-[calc(100vh-80px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2">
                        <Store className="text-blue-400" /> 영수증 설정
                    </h1>
                    <p className="text-slate-400 mt-1">고객에게 제공되는 영수증의 디자인과 내용을 관리합니다.</p>
                </div>
                <button
                    onClick={handleUpdate}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50"
                >
                    {saving ? '저장 중...' : <><Save size={20} /> 설정 저장</>}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 설정 폼 */}
                <div className="space-y-6">
                    <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Type className="text-gray-400" /> 기본 문구 설정
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">영수증 제목</label>
                                <input
                                    type="text"
                                    value={settings.title}
                                    onChange={e => setSettings({ ...settings, title: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">상단 인사말</label>
                                <textarea
                                    rows={2}
                                    value={settings.greetings}
                                    onChange={e => setSettings({ ...settings, greetings: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">하단 안내문</label>
                                <textarea
                                    rows={2}
                                    value={settings.footer_text}
                                    onChange={e => setSettings({ ...settings, footer_text: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <CheckSquare className="text-gray-400" /> 노출 항목 필터
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { id: 'show_order_number', label: '주문번호 표시' },
                                { id: 'show_item_details', label: '상품 상세 표시' },
                                { id: 'show_store_address', label: '매장 주소 표시' },
                                { id: 'show_points', label: '포인트 정보 표시' }
                            ].map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => toggleField(item.id)}
                                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${settings[item.id] ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-100 text-gray-400'}`}
                                >
                                    {settings[item.id] ? <CheckSquare /> : <Square />}
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* 실시간 미리보기 (모바일 영수증 스타일) */}
                <div className="sticky top-0">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Eye className="text-gray-400" /> 프리뷰 (미리보기)
                    </h3>
                    <div className="bg-gray-100 p-8 rounded-3xl flex justify-center border-4 border-white shadow-inner">
                        <div className="w-[320px] bg-white shadow-2xl rounded-sm p-6 flex flex-col font-mono text-sm leading-tight text-gray-800 border-t-8 border-blue-500 relative">
                            {/* 절취선 효과 */}
                            <div className="absolute -top-1 left-0 right-0 h-1 flex justify-between px-1 overflow-hidden">
                                {[...Array(20)].map((_, i) => <div key={i} className="w-2 h-2 bg-gray-100 rounded-full shrink-0" />)}
                            </div>

                            <div className="text-center mb-6 border-b border-dashed border-gray-300 pb-4">
                                <h2 className="text-xl font-black mb-1 tracking-widest">{settings.title}</h2>
                                <div className="text-xs text-gray-400 mb-2 uppercase tracking-tighter">Receipt for Payment</div>
                                <p className="whitespace-pre-line text-xs font-sans text-gray-500">{settings.greetings}</p>
                            </div>

                            {settings.show_order_number ? (
                                <div className="flex justify-between items-center mb-4 py-2 border-b border-gray-100">
                                    <span className="text-gray-400">Order No.</span>
                                    <span className="font-bold text-lg">#2026-0034</span>
                                </div>
                            ) : null}

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="font-bold">카페 아메리카노 (Iced)</div>
                                        <div className="text-[10px] text-gray-400">샷 추가 / 시럽 제외</div>
                                    </div>
                                    <div className="text-right">
                                        <div>1 x {formatPrice(4500)}</div>
                                        <div className="font-bold">{formatPrice(4500)}</div>
                                    </div>
                                </div>
                                {settings.show_item_details ? (
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="font-bold">햄치즈 샌드위치</div>
                                            <div className="text-[10px] text-gray-400">오븐 가열</div>
                                        </div>
                                        <div className="text-right">
                                            <div>1 x {formatPrice(6800)}</div>
                                            <div className="font-bold">{formatPrice(6800)}</div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <div className="border-t-2 border-dashed border-black pt-4 mb-4">
                                <div className="flex justify-between text-lg font-black mb-1">
                                    <span>TOTAL</span>
                                    <span>{formatPrice(11300)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>VAT (10%)</span>
                                    <span>1,027</span>
                                </div>
                            </div>

                            {settings.show_points ? (
                                <div className="bg-gray-50 p-2 rounded text-xs mb-4 border border-gray-100">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-gray-400">사용한 포인트</span>
                                        <span className="text-red-500 font-bold">-0 P</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">적립된 포인트</span>
                                        <span className="text-blue-500 font-bold">+113 P</span>
                                    </div>
                                </div>
                            ) : null}

                            <div className="text-center mt-auto pt-6 border-t border-dashed border-gray-300 text-[10px] text-gray-400 font-sans tracking-tight">
                                {settings.show_store_address ? (
                                    <p className="mb-2">서울 강남구 테헤란로 123 위마켓 빌딩 1층<br />TEL: 02-1234-5678</p>
                                ) : null}
                                <p className="whitespace-pre-line leading-relaxed">{settings.footer_text}</p>
                                <div className="mt-4 opacity-50">----------------------------</div>
                                <div className="mt-1 font-mono uppercase">Thank you for your business!</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReceiptSettings;
