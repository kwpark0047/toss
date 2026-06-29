import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    QrCode, Store, Bell, CreditCard, Clock, BarChart3,
    Users, Smartphone, Check, ArrowRight, Menu, X, ChevronRight,
    Zap, Link2, Gift, ShieldCheck, Play, Sparkles,
    TrendingUp, Star,
} from 'lucide-react';

const LandingPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [demoStep, setDemoStep] = useState(0); // 0=entry, 1=uuid, 2=menu, 3=shared
    const [uuidStr, setUuidStr] = useState('');
    const [cycleKey, setCycleKey] = useState(0); // 사이클 재시작 트리거
    const DEMO_UUID = 'a3f9-bc2e-7d81-4f0a';

    // 히어로 폰 목업 자동 순환 — cycleKey가 바뀔 때만 재실행
    useEffect(() => {
        setDemoStep(0);
        setUuidStr('');
        let ivRef = null;
        const t1 = setTimeout(() => setDemoStep(1), 1800);
        const t2 = setTimeout(() => {
            let i = 0;
            ivRef = setInterval(() => {
                i++;
                setUuidStr(DEMO_UUID.slice(0, i));
                if (i >= DEMO_UUID.length) clearInterval(ivRef);
            }, 60);
        }, 2200);
        const t3 = setTimeout(() => setDemoStep(2), 3800);
        const t4 = setTimeout(() => setDemoStep(3), 5500);
        const t5 = setTimeout(() => setCycleKey(k => k + 1), 8000);
        return () => {
            clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
            clearTimeout(t4); clearTimeout(t5);
            if (ivRef) clearInterval(ivRef);
        };
    }, [cycleKey]);

    const navItems = [
        { label: '기능 소개', href: '#features' },
        { label: '이용 방법', href: '#how-to' },
        { label: '요금제', href: '#pricing' },
        { label: '데모 보기', href: '#demo' },
    ];

    const features = [
        { icon: QrCode,      title: 'QR 코드 즉시 생성',   desc: '테이블마다 고유한 QR 코드를 자동 생성. 출력해서 테이블에 부착하면 바로 사용 가능합니다.', color: 'orange' },
        { icon: Store,       title: '매장 통합 관리',       desc: '매장 정보, 영업시간, 위치까지 한 곳에서 관리. 지역별 매장 분류도 지원합니다.', color: 'blue' },
        { icon: Users,       title: '직원 권한 관리',       desc: '마스터 관리자부터 테이블 담당, 주방 직원까지 역할별 권한을 세밀하게 분리합니다.', color: 'green' },
        { icon: Smartphone,  title: '웹앱 기반 주문',       desc: '앱 설치 없이 브라우저에서 바로 주문. 고객의 진입 장벽을 최소화합니다.', color: 'purple' },
        { icon: Bell,        title: '실시간 알림',          desc: '주문이 들어오면 담당 직원과 주방에 즉시 알림. 주문 누락을 방지합니다.', color: 'red' },
        { icon: CreditCard,  title: '다양한 결제 수단',     desc: '현금, 계좌이체는 물론 다양한 간편결제까지 지원합니다.', color: 'indigo' },
        { icon: Clock,       title: '대기·예약 관리',       desc: '대기 번호 자동 발급, 사전 예약 관리로 고객 경험을 향상시킵니다.', color: 'yellow' },
        { icon: BarChart3,   title: '매출 분석',            desc: '일별, 월별, 연도별 매출 통계와 결제 수단별 분석 리포트를 제공합니다.', color: 'teal' },
    ];

    const steps = [
        { num: '01', title: '매장 등록', desc: '매장 정보를 입력하고 메뉴를 등록합니다.' },
        { num: '02', title: 'QR 인쇄',  desc: '테이블별 QR 코드를 출력해 부착합니다.' },
        { num: '03', title: '고객 주문', desc: '고객이 QR 스캔 후 메뉴를 선택합니다.' },
        { num: '04', title: '결제 완료', desc: '원하는 결제 수단으로 즉시 결제합니다.' },
    ];

    const customerFlow = [
        { icon: '📱', label: 'QR 스캔' },
        { icon: '📋', label: '메뉴 확인' },
        { icon: '🛒', label: '메뉴 담기' },
        { icon: '💳', label: '결제하기' },
        { icon: '🍽️', label: '음식 받기' },
    ];

    const pricingPlans = [
        {
            name: '무료', price: '₩0', period: '/월',
            features: ['QR 코드 생성', '주문 알림 (웹)', '기본 매출 통계'],
            cta: '무료로 시작', popular: false,
        },
        {
            name: '프로', price: '₩20,000', period: '/월',
            features: ['모든 결제 수단 지원', '실시간 주방 알림', '상세 매출 분석', '대기/예약 관리', '우선 고객 지원'],
            cta: '프로 시작하기', popular: true,
        },
        {
            name: '엔터프라이즈', price: '₩79,000', period: '/월',
            features: ['전용 서버 인프라', 'API 연동 지원', '맞춤형 리포트', '전담 매니저 배정', '광고 노출 우선권'],
            cta: '문의하기', popular: false,
        },
    ];

    const iconColorMap = {
        orange: 'bg-orange-100 text-orange-500', blue: 'bg-blue-100 text-blue-500',
        green: 'bg-green-100 text-green-500', purple: 'bg-purple-100 text-purple-500',
        red: 'bg-red-100 text-red-500', indigo: 'bg-indigo-100 text-indigo-500',
        yellow: 'bg-yellow-100 text-yellow-600', teal: 'bg-teal-100 text-teal-500',
    };

    // 데모 UX 혁신 3가지
    const demoFeatures = [
        {
            icon: <Zap size={22} className="text-amber-400" />,
            badge: 'Zero Friction',
            title: '스캔 하나로 바로 주문',
            desc: '회원가입·로그인 없이 QR 스캔만으로 즉시 장바구니 세션 생성. 랜덤 UUID가 실시간으로 할당됩니다.',
            stat: '진입 마찰 0%',
            color: 'amber',
        },
        {
            icon: <Link2 size={22} className="text-emerald-400" />,
            badge: '공유 오더',
            title: '동석자와 함께 담는 장바구니',
            desc: '테이블 공유 세션이 자동 활성화. 다른 사람이 담은 메뉴가 내 화면에 실시간으로 반영됩니다.',
            stat: '그룹 주문 전환율 +38%',
            color: 'emerald',
        },
        {
            icon: <Gift size={22} className="text-purple-400" />,
            badge: '손실 회피',
            title: '60초 타이머로 회원가입 유도',
            desc: '결제 후 포인트가 소멸되기 시작하는 타이머와 사전 입력된 전화번호로 원버튼 가입 완료.',
            stat: '전환율 +62%',
            color: 'purple',
        },
    ];

    return (
        <div className="min-h-screen bg-white text-gray-900">

            {/* ── 헤더 ── */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center">
                            <span className="text-white font-black text-lg">W</span>
                        </div>
                        <span className="text-xl font-black text-gray-900">위마켓</span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-8">
                        {navItems.map(item => (
                            <a key={item.label} href={item.href}
                                className="text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors">
                                {item.label}
                            </a>
                        ))}
                    </nav>

                    <div className="hidden md:flex items-center gap-4">
                        {user ? (
                            <button onClick={() => navigate('/admin')}
                                className="px-5 py-2 bg-orange-500 text-white rounded-full font-bold text-sm hover:bg-orange-600 transition-colors">
                                대시보드
                            </button>
                        ) : (
                            <>
                                <Link to="/auth" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">로그인</Link>
                                <Link to="/register"
                                    className="px-5 py-2.5 bg-orange-500 text-white rounded-full font-bold text-sm hover:bg-orange-600 transition-colors shadow-md shadow-orange-100">
                                    무료로 시작하기
                                </Link>
                            </>
                        )}
                    </div>

                    <button className="md:hidden p-2 text-gray-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="md:hidden bg-white border-t border-gray-100 px-6 py-6 space-y-4 overflow-hidden">
                            {navItems.map(item => (
                                <a key={item.label} href={item.href}
                                    className="block text-base font-medium text-gray-700 hover:text-orange-500"
                                    onClick={() => setMobileMenuOpen(false)}>{item.label}</a>
                            ))}
                            <div className="pt-4 border-t border-gray-100 space-y-3">
                                <Link to="/auth" className="block text-center py-3 text-gray-700 font-bold border border-gray-200 rounded-full">로그인</Link>
                                <Link to="/register" className="block text-center py-3 bg-orange-500 text-white rounded-full font-bold hover:bg-orange-600 transition-colors">무료로 시작하기</Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* ══════════════════════════════════════════════
                히어로 섹션
            ══════════════════════════════════════════════ */}
            <section className="pt-28 pb-20 px-6 bg-gradient-to-br from-orange-50 via-white to-slate-50">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">

                    {/* 왼쪽 텍스트 */}
                    <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7 }} className="flex-1">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-6">
                            🚀 QR 하나로 완성하는 스마트 매장
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black leading-[1.2] mb-6 text-gray-900">
                            앱 설치 없이<br />
                            <span className="text-orange-500">QR 스캔 한 번</span>으로<br />
                            주문부터 결제까지
                        </h1>
                        <p className="text-lg text-gray-500 mb-8 leading-relaxed max-w-lg">
                            위마켓은 종이 메뉴판과 복잡한 POS를 대체하는 올인원 QR 메뉴판 플랫폼입니다.
                            테이블마다 QR 코드 하나로 주문, 결제, 대기까지 한번에.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/register')}
                                className="flex items-center justify-center gap-2 px-8 py-4 bg-orange-500 text-white rounded-full font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200">
                                무료로 시작하기 <ArrowRight size={20} />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/menu/demo')}
                                className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-full font-bold text-lg hover:border-orange-300 hover:text-orange-500 transition-colors">
                                <Play size={18} className="fill-current" /> 데모 체험하기
                            </motion.button>
                        </div>

                        {/* 통계 */}
                        <div className="flex gap-10 mt-12 pt-8 border-t border-gray-100">
                            {[
                                { value: '1,000+', label: '등록 매장' },
                                { value: '500만+', label: '누적 주문' },
                                { value: '99%',    label: '고객 만족도' },
                            ].map(stat => (
                                <div key={stat.label}>
                                    <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                                    <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* 오른쪽: 인터랙티브 폰 목업 */}
                    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="flex-1 flex justify-center items-center gap-4">

                        {/* 미니 시스템 모니터 */}
                        <div className="hidden lg:flex flex-col w-48 bg-slate-950 rounded-2xl p-4 gap-2 shadow-2xl self-center">
                            <div className="flex gap-1 mb-1">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                            </div>
                            <p className="text-[9px] font-mono text-slate-500">wemarket monitor</p>
                            <div className="space-y-1.5 font-mono text-[9px]">
                                <AnimatePresence mode="wait">
                                    {demoStep === 0 && (
                                        <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
                                            <p className="text-slate-600">&gt; POS v3.2.1</p>
                                            <p className="text-slate-600 animate-pulse">&gt; QR 대기 중...</p>
                                        </motion.div>
                                    )}
                                    {demoStep >= 1 && (
                                        <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                                            <p className="text-emerald-400">&gt; QR 스캔 ✓</p>
                                            <p className="text-slate-400">&gt; UUID 생성 중...</p>
                                            {uuidStr && <p className="text-purple-400 break-all">&gt; {uuidStr}{uuidStr.length < DEMO_UUID.length ? <span className="animate-pulse">█</span> : null}</p>}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                {demoStep >= 2 && (
                                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-400">&gt; CART_ALLOCATED ✓</motion.p>
                                )}
                                {demoStep >= 3 && (
                                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-amber-300 font-bold">&gt; ZERO_FRICTION ✓</motion.p>
                                )}
                            </div>
                        </div>

                        {/* 폰 외형 */}
                        <div className="relative">
                            <div className="w-64 bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                                <div className="bg-white rounded-[2.5rem] overflow-hidden">
                                    {/* 상단바 */}
                                    <div className="bg-gray-900 px-6 py-3 flex justify-between items-center">
                                        <span className="text-white text-xs font-bold">9:41</span>
                                        <div className="w-20 h-5 bg-black rounded-full" />
                                        <div className="w-4 h-2.5 border border-white rounded-sm flex items-center px-0.5">
                                            <div className="w-full h-1.5 bg-white rounded-sm" />
                                        </div>
                                    </div>

                                    {/* 앱 화면 */}
                                    <AnimatePresence mode="wait">
                                        {demoStep <= 1 && (
                                            <motion.div key="entry-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="bg-gradient-to-br from-orange-500 to-rose-600 p-6 flex flex-col items-center min-h-[320px] justify-center">
                                                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                                                    <QrCode size={28} className="text-white" strokeWidth={1.5} />
                                                </div>
                                                <p className="text-white font-black text-sm text-center">위마켓 시그니처 카페</p>
                                                <p className="text-white/60 text-xs mt-1">테이블 A-07</p>
                                                <div className="w-full mt-6 space-y-2 text-[10px] text-white/70">
                                                    {['가입 없이 바로 주문', '임시 세션 자동 생성', '포인트 적립 연동'].map((t, i) => (
                                                        <div key={i} className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full bg-white/30 flex items-center justify-center text-[7px]">✓</div>
                                                            {t}
                                                        </div>
                                                    ))}
                                                </div>
                                                <motion.div animate={demoStep === 1 ? { scale: [1, 1.05, 1] } : {}}
                                                    transition={{ duration: 0.4 }}
                                                    className="mt-5 w-full bg-white rounded-xl py-2.5 text-center">
                                                    <p className="text-orange-600 font-black text-xs">스캔 완료 — 주문 시작</p>
                                                </motion.div>
                                            </motion.div>
                                        )}
                                        {demoStep === 2 && (
                                            <motion.div key="menu-screen" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                                                className="bg-white min-h-[320px]">
                                                <div className="bg-white px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                                                    <p className="text-[10px] font-black text-slate-900">위마켓 시그니처 카페</p>
                                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded-full">
                                                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                                        <p className="text-[8px] font-black text-emerald-700">공유 ON</p>
                                                    </div>
                                                </div>
                                                <div className="p-3 space-y-2">
                                                    {['아메리카노 · 4,500원', '시그니처 라떼 · 6,500원', '말차 라떼 · 5,500원'].map((item, i) => (
                                                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                                                            <p className="text-[10px] font-bold text-slate-800">{item}</p>
                                                            <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">+</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                        {demoStep === 3 && (
                                            <motion.div key="shared-screen" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                                                className="bg-slate-900 text-white min-h-[320px] p-4 flex flex-col justify-center">
                                                <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2 mb-4">
                                                    <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-black">M</div>
                                                    <div>
                                                        <p className="text-[10px] font-black">김민준님이 담았어요 ☕</p>
                                                        <p className="text-[9px] text-slate-400">아메리카노 · 4,500원</p>
                                                    </div>
                                                </div>
                                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                                                    <p className="text-[9px] text-amber-400 font-bold">⏱ 적립 포인트 소멸까지</p>
                                                    <p className="text-2xl font-black text-amber-300 mt-1">54초</p>
                                                    <div className="h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                                                        <div className="h-full bg-amber-400 rounded-full" style={{ width: '82%' }} />
                                                    </div>
                                                    <div className="mt-3 w-full bg-amber-500 rounded-lg py-2 text-center">
                                                        <p className="text-[9px] font-black text-white">3초 만에 포인트 보존 ⚡</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* 플로팅 배지 */}
                            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute -right-14 top-16 bg-white rounded-2xl shadow-xl px-4 py-2.5 border border-gray-100">
                                <p className="text-[10px] text-gray-400">주문 완료!</p>
                                <p className="text-sm font-bold text-gray-800">+128 P 적립</p>
                            </motion.div>
                            <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute -left-14 bottom-20 bg-emerald-500 rounded-2xl shadow-xl px-4 py-2.5">
                                <p className="text-[10px] text-emerald-100">공유 오더</p>
                                <p className="text-sm font-bold text-white">2명 참여 중</p>
                            </motion.div>

                            {/* 데모 이동 버튼 */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
                                className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                <Link to="/menu/demo"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-full text-xs font-black shadow-lg hover:bg-slate-800 transition-colors">
                                    <Play size={12} className="fill-current" /> 직접 체험해보기
                                </Link>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                기능 소개
            ══════════════════════════════════════════════ */}
            <section id="features" className="py-24 px-6 bg-white">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">기능 소개</span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4">매장 운영에 필요한 모든 것</h2>
                        <p className="text-gray-500 text-lg">종이 메뉴판, 복잡한 POS, 예약 수첩… 이제 위마켓 하나로 통합하세요.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, i) => (
                            <motion.div key={feature.title}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.07 }} viewport={{ once: true }}
                                className="p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-md hover:-translate-y-1 transition-all cursor-default">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconColorMap[feature.color]}`}>
                                    <feature.icon size={22} />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                이용 방법
            ══════════════════════════════════════════════ */}
            <section id="how-to" className="py-24 px-6 bg-gray-50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">이용 방법</span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4">단 4단계로 스마트 매장 완성</h2>
                        <p className="text-gray-500 text-lg">복잡한 설정 없이 누구나 쉽게 시작할 수 있습니다.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
                        {steps.map((step, i) => (
                            <motion.div key={step.num}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                                className="text-center">
                                <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-orange-200">
                                    {step.num}
                                </div>
                                <h3 className="font-bold text-gray-900 text-lg mb-2">{step.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* 고객 경험 플로우 */}
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        className="mt-20 bg-white rounded-3xl p-10 shadow-sm border border-gray-100">
                        <h3 className="text-2xl font-black text-gray-900 text-center mb-10">고객 입장에서는?</h3>
                        <div className="flex flex-wrap justify-center items-center gap-3">
                            {customerFlow.map((item, i) => (
                                <div key={item.label} className="flex items-center gap-3">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-3xl border border-gray-100 shadow-sm">
                                            {item.icon}
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">{item.label}</span>
                                    </div>
                                    {i < customerFlow.length - 1 && <ChevronRight className="text-gray-300 flex-shrink-0 mb-5" size={24} />}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                ★ 고객 UX 데모 쇼케이스 (신규 핵심 섹션) ★
            ══════════════════════════════════════════════ */}
            <section id="demo" className="py-24 px-6 bg-slate-950 overflow-hidden relative">
                {/* 배경 그리드 */}
                <div className="absolute inset-0 opacity-5"
                    style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

                <div className="max-w-7xl mx-auto relative">
                    {/* 섹션 헤더 */}
                    <div className="text-center mb-16">
                        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-500/20 text-orange-400 rounded-full text-sm font-bold mb-6 border border-orange-500/20">
                                <Sparkles size={13} /> 고객 UX 혁신 데모
                            </span>
                            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                                고객 전환율을 바꾸는<br />
                                <span className="text-orange-400">3가지 UX 혁신</span>
                            </h2>
                            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                                QR 스캔부터 포인트 가입까지, 고객이 자연스럽게 충성 고객으로 전환되는 완전한 여정을 직접 체험해보세요.
                            </p>
                        </motion.div>
                    </div>

                    {/* 3가지 UX 혁신 카드 */}
                    <div className="grid md:grid-cols-3 gap-6 mb-16">
                        {demoFeatures.map((f, i) => (
                            <motion.div key={i}
                                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.12 }} viewport={{ once: true }}
                                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-600 transition-all group">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                                    f.color === 'amber'   ? 'bg-amber-500/15' :
                                    f.color === 'emerald' ? 'bg-emerald-500/15' : 'bg-purple-500/15'
                                }`}>
                                    {f.icon}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                    f.color === 'amber'   ? 'bg-amber-500/20 text-amber-400' :
                                    f.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'
                                }`}>{f.badge}</span>
                                <h3 className="text-white font-black text-lg mt-3 mb-2">{f.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-4">{f.desc}</p>
                                <div className="flex items-center gap-2 pt-4 border-t border-slate-800">
                                    <TrendingUp size={13} className={
                                        f.color === 'amber'   ? 'text-amber-400' :
                                        f.color === 'emerald' ? 'text-emerald-400' : 'text-purple-400'
                                    } />
                                    <span className={`text-xs font-black ${
                                        f.color === 'amber'   ? 'text-amber-400' :
                                        f.color === 'emerald' ? 'text-emerald-400' : 'text-purple-400'
                                    }`}>{f.stat}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* 데모 체험 CTA 블록 */}
                    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        className="bg-gradient-to-r from-orange-500/10 to-rose-500/10 border border-orange-500/20 rounded-3xl p-10 flex flex-col md:flex-row items-center gap-8">

                        {/* 왼쪽: 프리뷰 카드들 */}
                        <div className="flex gap-3 flex-shrink-0">
                            {/* ZFO 카드 */}
                            <div className="w-36 bg-gradient-to-br from-orange-500 to-rose-600 rounded-2xl p-4 shadow-xl">
                                <QrCode size={24} className="text-white mb-3" strokeWidth={1.5} />
                                <p className="text-white font-black text-xs leading-tight">스캔 완료</p>
                                <p className="text-white/60 text-[9px] mt-1">세션 자동 생성</p>
                                <div className="mt-3 bg-white/20 rounded-lg px-2 py-1">
                                    <p className="text-white text-[8px] font-mono break-all">a3f9-bc2e...</p>
                                </div>
                            </div>
                            {/* 공유 오더 카드 */}
                            <div className="w-36 bg-slate-900 rounded-2xl p-4 shadow-xl border border-slate-700">
                                <div className="flex -space-x-1 mb-3">
                                    <div className="w-7 h-7 rounded-full bg-orange-500 border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-white">M</div>
                                    <div className="w-7 h-7 rounded-full bg-purple-500 border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-white">J</div>
                                </div>
                                <p className="text-white font-black text-xs">공유 오더 ON</p>
                                <p className="text-slate-400 text-[9px] mt-1">2명 참여 중</p>
                                <div className="mt-3 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <p className="text-emerald-400 text-[8px] font-bold">LIVE</p>
                                </div>
                            </div>
                            {/* 포인트 카드 */}
                            <div className="w-36 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-4 shadow-xl">
                                <Gift size={20} className="text-amber-400 mb-3" />
                                <p className="text-amber-300 font-black text-lg">+128 P</p>
                                <div className="h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-amber-400 rounded-full" style={{ width: '60%' }} />
                                </div>
                                <p className="text-amber-400 text-[9px] font-bold mt-1">36초 후 소멸</p>
                            </div>
                        </div>

                        {/* 오른쪽: 텍스트 & CTA */}
                        <div className="flex-1 text-center md:text-left">
                            <h3 className="text-2xl md:text-3xl font-black text-white mb-3">
                                지금 직접 경험해보세요
                            </h3>
                            <p className="text-slate-400 mb-6 leading-relaxed">
                                가입 불필요, 결제 없음. QR 스캔부터 포인트 가입까지<br className="hidden md:block" />
                                실제 고객이 경험하는 그대로를 체험할 수 있습니다.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                                <Link to="/menu/demo">
                                    <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-orange-500 text-white rounded-full font-black text-base hover:bg-orange-600 transition-colors shadow-xl shadow-orange-500/30 cursor-pointer">
                                        <Play size={18} className="fill-current" />
                                        고객 메뉴 데모 체험하기
                                        <ArrowRight size={18} />
                                    </motion.div>
                                </Link>
                                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                                    <ShieldCheck size={14} className="text-emerald-500" />
                                    실제 결제 없음 · 데모 모드
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                요금제
            ══════════════════════════════════════════════ */}
            <section id="pricing" className="py-24 px-6 bg-gray-50">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">요금제</span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4">합리적인 가격, 강력한 기능</h2>
                        <p className="text-gray-500">결제 수수료 별도 · VAT 포함 가격 · 연간 결제시 2개월 무료</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6 items-center">
                        {pricingPlans.map((plan, i) => (
                            <motion.div key={plan.name}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                                className={`rounded-3xl p-8 flex flex-col ${plan.popular
                                    ? 'bg-gray-900 text-white shadow-2xl md:scale-105'
                                    : 'bg-white border border-gray-200'
                                }`}>
                                <h3 className={`text-lg font-bold mb-1 ${plan.popular ? 'text-gray-300' : 'text-gray-500'}`}>{plan.name}</h3>
                                <div className="flex items-end gap-1 mb-6">
                                    <span className="text-4xl font-black">{plan.price}</span>
                                    <span className="mb-1 text-sm text-gray-400">{plan.period}</span>
                                </div>
                                <div className="space-y-3 mb-8 flex-1">
                                    {plan.features.map(f => (
                                        <div key={f} className="flex items-center gap-2.5">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${plan.popular ? 'bg-orange-500' : 'bg-orange-100'}`}>
                                                <Check size={11} className={plan.popular ? 'text-white' : 'text-orange-500'} />
                                            </div>
                                            <span className={`text-sm ${plan.popular ? 'text-gray-300' : 'text-gray-600'}`}>{f}</span>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => navigate('/register')}
                                    className={`w-full py-3.5 rounded-full font-bold transition-all text-sm ${plan.popular
                                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                                        : 'border-2 border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-500'
                                    }`}>
                                    {plan.cta}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                최종 CTA
            ══════════════════════════════════════════════ */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <div className="flex justify-center gap-1 mb-6">
                            {[...Array(5)].map((_, i) => <Star key={i} size={18} className="fill-amber-400 text-amber-400" />)}
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
                            지금 바로 매장을{' '}
                            <span className="text-orange-500">스마트하게</span>{' '}
                            운영하세요
                        </h2>
                        <p className="text-gray-500 text-lg mb-10">14일 무료 체험 · 신용카드 불필요</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/register')}
                                className="px-10 py-4 bg-orange-500 text-white rounded-full font-black text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 flex items-center justify-center gap-2">
                                무료로 시작하기 <ArrowRight size={22} />
                            </motion.button>
                            <Link to="/menu/demo">
                                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                    className="px-10 py-4 border-2 border-gray-200 text-gray-700 rounded-full font-black text-lg hover:border-orange-300 hover:text-orange-500 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                                    <Play size={18} className="fill-current" /> 고객 데모 체험하기
                                </motion.div>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── 푸터 ── */}
            <footer className="py-16 px-6 border-t border-gray-100 bg-white">
                <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-10 mb-12">
                    <div className="col-span-2">
                        <Link to="/" className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                                <span className="text-white font-black">W</span>
                            </div>
                            <span className="text-lg font-black text-gray-900">위마켓</span>
                        </Link>
                        <p className="text-gray-400 text-sm leading-relaxed max-w-xs">종이 메뉴판과 복잡한 POS를 대체하는 올인원 QR 메뉴판 플랫폼. 전국 소상공인과 함께 성장합니다.</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 mb-4 text-sm">플랫폼</h4>
                        <ul className="space-y-3 text-sm text-gray-500">
                            <li><a href="#features" className="hover:text-orange-500 transition-colors">기능 소개</a></li>
                            <li><a href="#pricing" className="hover:text-orange-500 transition-colors">요금제</a></li>
                            <li><Link to="/menu/demo" className="hover:text-orange-500 transition-colors">고객 데모</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 mb-4 text-sm">고객 지원</h4>
                        <ul className="space-y-3 text-sm text-gray-500">
                            <li><Link to="/board" className="hover:text-orange-500 transition-colors">공지사항</Link></li>
                            <li><a href="#" className="hover:text-orange-500 transition-colors">FAQ</a></li>
                            <li><a href="#" className="hover:text-orange-500 transition-colors">문의하기</a></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between border-t border-gray-100 pt-8 gap-4">
                    <p className="text-xs text-gray-400">© 2026 WeMarket. All rights reserved.</p>
                    <div className="flex gap-6 text-xs text-gray-400">
                        <a href="#" className="hover:text-gray-600 transition-colors">개인정보처리방침</a>
                        <a href="#" className="hover:text-gray-600 transition-colors">이용약관</a>
                        <a href="#" className="hover:text-gray-600 transition-colors">사업자정보</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
