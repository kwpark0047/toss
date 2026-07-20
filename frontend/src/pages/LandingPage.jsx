import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import StoreLocator from '../components/StoreLocator';
import { storesAPI } from '../api/stores';
import { getRecentStores } from '../utils/recentStores';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import {
    QrCode, Store, Bell, CreditCard, Clock, BarChart3,
    Users, Smartphone, Check, ArrowRight, Menu, X, ChevronRight,
    Zap, Link2, Gift, ShieldCheck, Play, Sparkles,
    TrendingUp, Star, Quote, ShoppingCart,
    Heart, Crown, Award, BadgeCheck, CalendarDays, UserPlus,
    Building2, Share2, Megaphone, MapPin, Repeat2, Target,
} from 'lucide-react';

const LandingPage = () => {
    const { user } = useAuth();
    const { t } = useTranslation('landing', { keyPrefix: 'landing' });
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [demoStep, setDemoStep] = useState(0); // 0=entry, 1=uuid, 2=menu, 3=shared
    const [uuidStr, setUuidStr] = useState('');
    const [cycleKey, setCycleKey] = useState(0); // 사이클 재시작 트리거
    const DEMO_UUID = 'a3f9-bc2e-7d81-4f0a';
    const [popularStores, setPopularStores] = useState([]);
    const [popularLoading, setPopularLoading] = useState(true);
    const [recentStores] = useState(() => getRecentStores());

    useEffect(() => {
        storesAPI.getPopular().then(res => {
            setPopularStores(Array.isArray(res) ? res : (res?.data || []));
        }).catch(() => {}).finally(() => setPopularLoading(false));
    }, []);

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
        { label: t('nav.features', '기능 소개'), to: '/features' },
        { label: t('nav.pricing', '요금제'), to: '/pricing' },
        { label: t('nav.locations', '매장 위치'), href: '#locations' },
        { label: t('nav.guides', '이용 가이드'), to: '/guides' },
        { label: t('nav.contact', '문의하기'), to: '/contact' },
        { label: t('nav.foodTruck', '푸드트럭'), to: '/foodtruck/landing' },
        { label: t('nav.demo', '데모 보기'), href: '#demo' },
    ];

    const features = [
        { icon: QrCode,      title: t('features.qrCode.title', 'QR 코드 즉시 생성'),   desc: t('features.qrCode.desc', '테이블마다 고유한 QR 코드를 자동 생성. 출력해서 테이블에 부착하면 바로 사용 가능합니다.'), color: 'orange' },
        { icon: Store,       title: t('features.storeManagement.title', '매장 통합 관리'),       desc: t('features.storeManagement.desc', '매장 정보, 영업시간, 위치까지 한 곳에서 관리. 지역별 매장 분류도 지원합니다.'), color: 'blue' },
        { icon: Users,       title: t('features.staffPermissions.title', '직원 권한 관리'),       desc: t('features.staffPermissions.desc', '마스터 관리자부터 테이블 담당, 주방 직원까지 역할별 권한을 세밀하게 분리합니다.'), color: 'green' },
        { icon: Smartphone,  title: t('features.webOrder.title', '웹앱 기반 주문'),       desc: t('features.webOrder.desc', '앱 설치 없이 브라우저에서 바로 주문. 고객의 진입 장벽을 최소화합니다.'), color: 'purple' },
        { icon: Bell,        title: t('features.realTimeAlerts.title', '실시간 알림'),          desc: t('features.realTimeAlerts.desc', '주문이 들어오면 담당 직원과 주방에 즉시 알림. 주문 누락을 방지합니다.'), color: 'red' },
        { icon: CreditCard,  title: t('features.paymentMethods.title', '다양한 결제 수단'),     desc: t('features.paymentMethods.desc', '현금, 계좌이체는 물론 다양한 간편결제까지 지원합니다.'), color: 'indigo' },
        { icon: Clock,       title: t('features.waitingReservation.title', '대기·예약 관리'),       desc: t('features.waitingReservation.desc', '대기 번호 자동 발급, 사전 예약 관리로 고객 경험을 향상시킵니다.'), color: 'yellow' },
        { icon: BarChart3,   title: t('features.salesAnalysis.title', '매출 분석'),            desc: t('features.salesAnalysis.desc', '일별, 월별, 연도별 매출 통계와 결제 수단별 분석 리포트를 제공합니다.'), color: 'teal' },
        { icon: Heart,       title: t('features.regularCustomers.title', '단골고객 관리리스트'),  desc: t('features.regularCustomers.desc', '방문 이력·포인트·VIP 등급 자동 추적. 개인화 쿠폰과 재방문 메시지로 단골을 키웁니다.'), color: 'rose' },
        { icon: Building2,   title: t('features.community.title', '지역 커뮤니티'),        desc: t('features.community.desc', '주변 제휴 매장과 연결해 공동 이벤트, 포인트 공유, 지역 피드로 상권 전체를 활성화합니다.'), color: 'sky' },
    ];

    const steps = [
        { num: '01', title: t('steps.step1.title', '매장 등록'), desc: t('steps.step1.desc', '매장 정보를 입력하고 메뉴를 등록합니다.'), },
        { num: '02', title: t('steps.step2.title', 'QR 인쇄'),  desc: t('steps.step2.desc', '테이블별 QR 코드를 출력해 부착합니다.'), },
        { num: '03', title: t('steps.step3.title', '고객 주문'), desc: t('steps.step3.desc', '고객이 QR 스캔 후 메뉴를 선택합니다.'), },
        { num: '04', title: t('steps.step4.title', '결제 완료'), desc: t('steps.step4.desc', '원하는 결제 수단으로 즉시 결제합니다.'), },
    ];

    const customerFlow = [
        { icon: '📱', label: t('customerFlow.qrScan', 'QR 스캔') },
        { icon: '📋', label: t('customerFlow.checkMenu', '메뉴 확인') },
        { icon: '🛒', label: t('customerFlow.addMenu', '메뉴 담기') },
        { icon: '💳', label: t('customerFlow.payment', '결제하기') },
        { icon: '🍽️', label: t('customerFlow.getFood', '음식 받기') },
    ];

    const pricingPlans = [
        {
            name: t('pricingPlan.free.name', '무료'), price: t('pricingPlan.free.price', '₩0'), period: t('pricingPlan.free.period', '/월'),
            features: [
                t('pricingPlan.free.features.qrCode', 'QR 코드 생성'),
                t('pricingPlan.free.features.orderNotification', '주문 알림 (웹)'),
                t('pricingPlan.free.features.basicStats', '기본 매출 통계')
            ],
            cta: t('pricingPlan.free.cta', '무료로 시작'), popular: false,
        },
        {
            name: t('pricingPlan.pro.name', '프로'), price: t('pricingPlan.pro.price', '₩20,000'), period: t('pricingPlan.pro.period', '/월'),
            features: [
                t('pricingPlan.pro.features.allPaymentMethods', '모든 결제 수단 지원'),
                t('pricingPlan.pro.features.realTimeKitchen', '실시간 주방 알림'),
                t('pricingPlan.pro.features.detailedAnalysis', '상세 매출 분석'),
                t('pricingPlan.pro.features.waitingReservation', '대기/예약 관리'),
                t('pricingPlan.pro.features.prioritySupport', '우선 고객 지원')
            ],
            cta: t('pricingPlan.pro.cta', '프로 시작하기'), popular: true,
        },
        {
            name: t('pricingPlan.enterprise.name', '엔터프라이즈'), price: t('pricingPlan.enterprise.price', '₩79,000'), period: t('pricingPlan.enterprise.period', '/월'),
            features: [
                t('pricingPlan.enterprise.features.dedicatedInfrastructure', '전용 서버 인프라'),
                t('pricingPlan.enterprise.features.apiIntegration', 'API 연동 지원'),
                t('pricingPlan.enterprise.features.customReports', '맞춤형 리포트'),
                t('pricingPlan.enterprise.features.dedicatedManager', '전담 매니저 배정'),
                t('pricingPlan.enterprise.features.advertisingPriority', '광고 노출 우선권')
            ],
            cta: t('pricingPlan.enterprise.cta', '문의하기'), popular: false,
        },
    ];

    const iconColorMap = {
        orange: 'bg-orange-100 text-orange-500', blue: 'bg-blue-100 text-blue-500',
        green: 'bg-green-100 text-green-500', purple: 'bg-purple-100 text-purple-500',
        red: 'bg-red-100 text-red-500', indigo: 'bg-indigo-100 text-indigo-500',
        yellow: 'bg-yellow-100 text-yellow-600', teal: 'bg-teal-100 text-teal-500',
        rose: 'bg-rose-100 text-rose-500', sky: 'bg-sky-100 text-sky-500',
    };

    const testimonials = [
        {
            name: t('testimonials.jungHo.name', '김정호'),
            role: t('testimonials.jungHo.role', '한식당 사장'),
            location: t('testimonials.jungHo.location', '서울 마포구'),
            avatar: '👨‍🍳',
            rating: 5,
            text: t('testimonials.jungHo.text', '종이 메뉴판을 없애고 위마켓으로 전환했더니 주문 실수가 확 줄었어요. 특히 주방 알림 기능이 정말 편리하고, 매출 통계도 한눈에 볼 수 있어서 운영이 훨씬 수월해졌습니다.'),
            stat: t('testimonials.jungHo.stat', '주문 오류 80% 감소'),
            color: 'orange',
        },
        {
            name: t('testimonials.suJin.name', '박수진'),
            role: t('testimonials.suJin.role', '카페 운영자'),
            location: t('testimonials.suJin.location', '부산 해운대구'),
            avatar: '☕',
            rating: 5,
            text: t('testimonials.suJin.text', 'QR 하나로 테이블 관리부터 결제까지 해결돼요. 아르바이트생도 하루 만에 익혔고, 고객들이 앱 없이 바로 주문할 수 있어서 거부감이 전혀 없습니다.'),
            stat: t('testimonials.suJin.stat', '운영 시간 30% 단축'),
            color: 'blue',
        },
        {
            name: t('testimonials.dongHyun.name', '이동현'),
            role: t('testimonials.dongHyun.role', '분식집·포장 전문'),
            location: t('testimonials.dongHyun.location', '대구 수성구'),
            avatar: '🍱',
            rating: 5,
            text: t('testimonials.dongHyun.text', '포인트 적립 기능으로 단골 고객이 눈에 띄게 늘었어요. 결제 후 60초 타이머로 자연스럽게 회원가입을 유도하는 방식이 정말 영리합니다. 재방문율이 크게 올랐어요.'),
            stat: t('testimonials.dongHyun.stat', '재방문율 62% 상승'),
            color: 'green',
        },
    ];

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
                            item.to ? (
                                <Link key={item.label} to={item.to}
                                    className="text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors">
                                    {item.label}
                                </Link>
                            ) : (
                                <a key={item.label} href={item.href}
                                    className="text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors">
                                    {item.label}
                                </a>
                            )
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
                        <LanguageSwitcher />
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
                                item.to ? (
                                    <Link key={item.label} to={item.to}
                                        className="block text-base font-medium text-gray-700 hover:text-orange-500"
                                        onClick={() => setMobileMenuOpen(false)}>{item.label}</Link>
                                ) : (
                                    <a key={item.label} href={item.href}
                                        className="block text-base font-medium text-gray-700 hover:text-orange-500"
                                        onClick={() => setMobileMenuOpen(false)}>{item.label}</a>
                                )
                            ))}
                            <div className="pt-4 border-t border-gray-100 space-y-3">
                                <Link to="/auth" className="block text-center py-3 text-gray-700 font-bold border border-gray-200 rounded-full">로그인</Link>
                                <Link to="/register" className="block text-center py-3 bg-orange-500 text-white rounded-full font-bold hover:bg-orange-600 transition-colors">무료로 시작하기</Link>
                                <LanguageSwitcher />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* ══════════════════════════════════════════════
                히어로 섹션
            ══════════════════════════════════════════════ */}
            <section className="pt-28 pb-20 px-6 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 45%, #f8faff 100%)' }}>
                {/* 장식 블러 원 */}
                <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-40 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.25) 0%, transparent 70%)' }} />
                <div className="absolute top-20 right-0 w-80 h-80 rounded-full opacity-30 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">

                    {/* 왼쪽 텍스트 */}
                    <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7 }} className="flex-1">
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-6">
                            <Sparkles size={14} className="animate-pulse" /> 모두의 메뉴판 플랫폼
                        </motion.div>
                        <motion.h1
                            className="text-4xl md:text-6xl font-black leading-[1.15] mb-6 text-gray-900 text-balance [word-break:keep-all]"
                            initial="hidden" animate="show"
                            variants={{ show: { transition: { staggerChildren: 0.14, delayChildren: 0.15 } } }}
                        >
                            {[
                                <><span className="text-gray-900">1인 자영업자</span>에게</>,
                                <><span className="ai-gradient-text">AI 지원 단골리스트</span>를</>,
                                <>만들어 드립니다.</>,
                            ].map((line, i) => (
                                <motion.span
                                    key={i}
                                    className="block"
                                    variants={{
                                        hidden: { opacity: 0, y: 26, filter: 'blur(8px)' },
                                        show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
                                    }}
                                >
                                    {line}
                                </motion.span>
                            ))}
                        </motion.h1>
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
                                onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
                                className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-full font-bold text-lg hover:border-orange-300 hover:text-orange-500 transition-colors">
                                <Play size={18} className="fill-current" /> 데모 체험하기
                            </motion.button>
                        </div>

                        {/* 통계 */}
                        <div className="flex gap-8 mt-12 pt-8 border-t border-gray-100">
                            {[
                                { value: '1,000+', label: '등록 매장', icon: Store },
                                { value: '500만+', label: '누적 주문', icon: ShoppingCart },
                                { value: '4.9★',   label: '평균 평점',  icon: Star },
                            ].map(stat => (
                                <div key={stat.label} className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                                        <stat.icon size={16} className="text-orange-500" />
                                    </div>
                                    <div>
                                        <p className="text-xl font-black text-gray-900 leading-none">{stat.value}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                                    </div>
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
            <section id="features" className="py-24 px-6 bg-white relative">
                <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <div className="max-w-7xl mx-auto relative z-10">
                        <div className="text-center mb-16">
                            <span classcn="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">{t('features.title', '기능 소개')}</span>
                            <h2 className="text-4xl font-black text-gray-900 mb-4 text-balance">{t('features.title', '매장 운영에 필요한 모든 것')}</h2>
                            <p className="text-gray-500 text-lg">{t('features.subtitle', '종이 메뉴판, 복잡한 POS, 예약 수첩… 이제 위마켓 하나로 통합하세요.')}</p>
                        </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
                        {features.map((feature, i) => (
                            <motion.div key={feature.title}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.07 }} viewport={{ once: true }}
                                className="p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-lg hover:-translate-y-1.5 hover:border-orange-100 transition-all duration-300 cursor-default group">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconColorMap[feature.color]} group-hover:scale-110 transition-transform duration-300`}>
                                    <feature.icon size={22} />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">{feature.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                단골고객 관리리스트 상세 섹션
            ══════════════════════════════════════════════ */}
            <section className="py-24 px-6 bg-gradient-to-br from-rose-50 via-white to-orange-50 overflow-hidden relative">
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-30 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.2) 0%, transparent 70%)' }} />
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="flex flex-col lg:flex-row items-center gap-16">

                        {/* 왼쪽: 설명 */}
                        <motion.div initial={{ opacity:0, x:-30 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} className="flex-1">
                            <div className="flex items-center gap-2 mb-5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-600 rounded-full text-xs font-black">
                                    <Heart size={12} className="fill-rose-500" /> 단골고객 관리리스트
                                </span>
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-black">핵심 기능</span>
                            </div>
                            <h2 className="text-4xl font-black text-gray-900 mb-4 leading-tight text-balance">
                                {t('regularCustomers.title1', '단골고객이 스스로')}<br />
                                <span className="text-rose-500">{t('regularCustomers.title2', '다시 찾아오는')}</span> {t('regularCustomers.title3', '매장')}
                            </h2>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                                {t('regularCustomers.description', 'QR 스캔 한 번으로 방문이 기록되고, 포인트가 쌓이고, VIP 등급이 자동 분류됩니다.')}<br />
                                {t('regularCustomers.manager', '사장님은 아무것도 하지 않아도 위마켓이 단골을 관리합니다.')}
                            </p>

                            <div className="space-y-4 mb-10">
                                {[
                                    { icon: BadgeCheck,    color:'text-rose-500',  bg:'bg-rose-50',  title:'방문 자동 기록',       desc:'QR 스캔 시 방문 이력 자동 저장. 번거로운 스탬프 카드 불필요.' },
                                    { icon: Award,         color:'text-amber-500', bg:'bg-amber-50', title:'포인트 & 스탬프',       desc:'결제 금액의 일정 % 자동 적립. 스탬프 카드도 디지털로 발급.' },
                                    { icon: Crown,         color:'text-violet-500',bg:'bg-violet-50',title:'VIP 자동 등급 분류',    desc:'방문 횟수·누적 금액 기준으로 일반→단골→VIP→VVIP 자동 승급.' },
                                    { icon: CalendarDays,  color:'text-pink-500',  bg:'bg-pink-50',  title:'생일·기념일 자동 쿠폰', desc:'등록된 생일에 맞춤 혜택을 자동 발송. 단골이 먼저 연락해 옵니다.' },
                                    { icon: UserPlus,      color:'text-emerald-500',bg:'bg-emerald-50',title:'개인화 재방문 유도',  desc:'"오랫동안 못 뵀네요 😊" 장기 미방문 고객에게 자동 메시지 발송.' },
                                    { icon: TrendingUp,    color:'text-blue-500',  bg:'bg-blue-50',  title:'고객 패턴 분석',       desc:'자주 오는 시간대·선호 메뉴·평균 객단가를 차트로 한눈에.' },
                                ].map((f, i) => (
                                    <motion.div key={i} initial={{ opacity:0, x:-16 }} whileInView={{ opacity:1, x:0 }}
                                        transition={{ delay: i * 0.08 }} viewport={{ once:true }}
                                        className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-rose-200 hover:shadow-md transition-all">
                                        <div className={`w-10 h-10 ${f.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                            <f.icon size={18} className={f.color} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm mb-0.5">{f.title}</p>
                                            <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                                onClick={() => navigate('/register')}
                                className="inline-flex items-center gap-2 px-7 py-3.5 bg-rose-500 text-white rounded-full font-black text-sm hover:bg-rose-600 transition-colors shadow-lg shadow-rose-200">
                                단골고객 관리 시작하기 <ArrowRight size={16} />
                            </motion.button>
                        </motion.div>

                        {/* 오른쪽: 고객 리스트 목업 */}
                        <motion.div initial={{ opacity:0, x:30 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }}
                            className="flex-1 flex flex-col gap-4 max-w-md w-full">

                            {/* 상단 통계 */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value:'+62%', label:'재방문율', color:'text-rose-600', bg:'bg-rose-50', border:'border-rose-100' },
                                    { value:'+28%', label:'평균 객단가', color:'text-amber-600', bg:'bg-amber-50', border:'border-amber-100' },
                                    { value:'41%',  label:'VIP 전환율', color:'text-violet-600', bg:'bg-violet-50', border:'border-violet-100' },
                                ].map(s => (
                                    <div key={s.label} className={`text-center py-4 ${s.bg} border ${s.border} rounded-2xl`}>
                                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* 고객 리스트 카드 */}
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                                    <p className="font-black text-gray-900 text-sm flex items-center gap-2"><Heart size={14} className="text-rose-500 fill-rose-500" /> 단골고객 리스트</p>
                                    <span className="text-xs text-gray-400">총 284명</span>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {[
                                        { name:'김민준', emoji:'👑', badge:'VVIP', visits:87, amount:'₩1,240,000', color:'text-violet-600', bg:'bg-violet-50' },
                                        { name:'이수진', emoji:'⭐', badge:'VIP',  visits:42, amount:'₩580,000',  color:'text-amber-600', bg:'bg-amber-50' },
                                        { name:'박정호', emoji:'💛', badge:'단골',  visits:18, amount:'₩226,000', color:'text-rose-500',  bg:'bg-rose-50' },
                                        { name:'최유진', emoji:'🌱', badge:'신규',   visits: 3, amount:'₩38,000',  color:'text-emerald-600',bg:'bg-emerald-50' },
                                    ].map((c, i) => (
                                        <motion.div key={i} initial={{ opacity:0, y:8 }} whileInView={{ opacity:1, y:0 }}
                                            transition={{ delay: i * 0.1 }} viewport={{ once:true }}
                                            className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                                            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">{c.emoji}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 text-sm">{c.name} 님</p>
                                                <p className="text-xs text-gray-400">{c.visits}회 방문</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-xs font-bold text-gray-700">{c.amount}</p>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.bg} ${c.color}`}>{c.badge}</span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                                {/* 알림 미리보기 */}
                                <div className="px-5 py-4 bg-rose-50/60 border-t border-rose-100">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <CalendarDays size={14} className="text-rose-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-gray-900">🎂 생일 쿠폰 자동 발송</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">이수진 님 생일 D-3 · 20% 할인 쿠폰 예약 발송</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 포인트 적립 토스트 */}
                            <motion.div animate={{ y:[0,-6,0] }} transition={{ duration:3.5, repeat:Infinity, ease:'easeInOut' }}
                                className="flex items-center gap-3 px-5 py-3 bg-amber-500 rounded-2xl shadow-lg self-end">
                                <span className="text-lg">✨</span>
                                <div>
                                    <p className="text-white text-xs font-black">포인트 적립!</p>
                                    <p className="text-amber-100 text-[10px]">+₩4,200 → 누적 ₩58,000</p>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                지역 커뮤니티 상세 섹션
            ══════════════════════════════════════════════ */}
            <section className="py-24 px-6 bg-gradient-to-br from-sky-50 via-white to-blue-50 overflow-hidden relative">
                <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-25 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.25) 0%, transparent 70%)' }} />
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="flex flex-col lg:flex-row-reverse items-center gap-16">

                        {/* 오른쪽(reversed): 설명 */}
                        <motion.div initial={{ opacity:0, x:30 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} className="flex-1">
                            <div className="flex items-center gap-2 mb-5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-full text-xs font-black">
                                    <Building2 size={12} /> 지역 커뮤니티
                                </span>
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black">상권 활성화</span>
                            </div>
                            <h2 className="text-4xl font-black text-gray-900 mb-4 leading-tight text-balance">
                                동네 매장과 함께<br />
                                <span className="text-sky-500">상권을 키우세요</span>
                            </h2>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                                혼자 힘들게 마케팅할 필요 없습니다. 주변 제휴 매장과 연결해 고객을 나누고,
                                지역 이벤트를 함께 기획하면 모두가 성장합니다.
                            </p>

                            <div className="space-y-4 mb-10">
                                {[
                                    { icon: Share2,     color:'text-sky-500',    bg:'bg-sky-50',     title:'제휴 매장 네트워크',    desc:'주변 매장과 연결해 고객을 서로 추천. 빈 테이블 없는 상권을 만듭니다.' },
                                    { icon: Megaphone,  color:'text-blue-500',   bg:'bg-blue-50',    title:'공동 이벤트 & 프로모션', desc:'지역 한정 이벤트를 함께 기획해 홍보 비용은 나누고 효과는 극대화.' },
                                    { icon: Repeat2,    color:'text-indigo-500', bg:'bg-indigo-50',  title:'통합 포인트 공유',       desc:'제휴 매장 어디서나 쌓고 쓸 수 있는 지역 통합 포인트 시스템.' },
                                    { icon: Target,     color:'text-violet-500', bg:'bg-violet-50',  title:'이웃 추천 보상',         desc:'단골이 이웃에게 추천하면 추천인·신규 고객 모두에게 즉시 보상.' },
                                    { icon: MapPin,     color:'text-rose-500',   bg:'bg-rose-50',    title:'지역 검색 우선 노출',    desc:'위마켓 앱과 지도 검색에서 내 매장이 지역 인근 고객에게 먼저 표시.' },
                                    { icon: Zap,        color:'text-amber-500',  bg:'bg-amber-50',   title:'실시간 지역 피드',       desc:'오늘의 특가, 이벤트, 새 메뉴를 지역 주민에게 실시간으로 푸시.' },
                                ].map((f, i) => (
                                    <motion.div key={i} initial={{ opacity:0, x:16 }} whileInView={{ opacity:1, x:0 }}
                                        transition={{ delay: i * 0.08 }} viewport={{ once:true }}
                                        className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-sky-200 hover:shadow-md transition-all">
                                        <div className={`w-10 h-10 ${f.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                            <f.icon size={18} className={f.color} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm mb-0.5">{f.title}</p>
                                            <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                                onClick={() => navigate('/register')}
                                className="inline-flex items-center gap-2 px-7 py-3.5 bg-sky-500 text-white rounded-full font-black text-sm hover:bg-sky-600 transition-colors shadow-lg shadow-sky-200">
                                지역 커뮤니티 참여하기 <ArrowRight size={16} />
                            </motion.button>
                        </motion.div>

                        {/* 왼쪽(reversed): 커뮤니티 시각화 */}
                        <motion.div initial={{ opacity:0, x:-30 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }}
                            className="flex-1 flex flex-col gap-4 max-w-md w-full">

                            {/* 상단 통계 */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value:'+43%', label:'신규 고객 유입', color:'text-sky-600',    bg:'bg-sky-50',    border:'border-sky-100' },
                                    { value:'+85%', label:'지역 충성도',    color:'text-blue-600',   bg:'bg-blue-50',   border:'border-blue-100' },
                                    { value:'+31%', label:'제휴 매출 증가', color:'text-indigo-600', bg:'bg-indigo-50', border:'border-indigo-100' },
                                ].map(s => (
                                    <div key={s.label} className={`text-center py-4 ${s.bg} border ${s.border} rounded-2xl`}>
                                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* 네트워크 맵 */}
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-6">
                                <p className="font-black text-gray-900 text-sm mb-5 flex items-center gap-2">
                                    <Building2 size={14} className="text-sky-500" /> 동네 제휴 매장 네트워크
                                </p>
                                {/* SVG 네트워크 */}
                                <div className="relative h-52">
                                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 340 200">
                                        {/* 연결선 */}
                                        <line x1="170" y1="100" x2="60"  y2="44"  stroke="#bae6fd" strokeWidth="2" strokeDasharray="5,4" />
                                        <line x1="170" y1="100" x2="280" y2="44"  stroke="#bae6fd" strokeWidth="2" strokeDasharray="5,4" />
                                        <line x1="170" y1="100" x2="50"  y2="164" stroke="#bae6fd" strokeWidth="2" strokeDasharray="5,4" />
                                        <line x1="170" y1="100" x2="290" y2="164" stroke="#bae6fd" strokeWidth="2" strokeDasharray="5,4" />
                                        <line x1="170" y1="100" x2="170" y2="10"  stroke="#bae6fd" strokeWidth="2" strokeDasharray="5,4" />
                                    </svg>
                                    {/* 내 매장 (중앙) */}
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                        <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-sky-200">
                                            <span className="text-white text-xs font-black text-center leading-tight">내<br/>매장</span>
                                        </div>
                                        <motion.div animate={{ scale:[1,1.4,1], opacity:[0.5,0,0.5] }}
                                            transition={{ duration:2.5, repeat:Infinity }}
                                            className="absolute inset-0 rounded-2xl bg-sky-400/30" />
                                    </div>
                                    {/* 제휴 매장들 */}
                                    {[
                                        { top:'-2px', left:'42px', emoji:'☕', label:'카페' },
                                        { top:'-2px', right:'22px', emoji:'🍕', label:'피자' },
                                        { bottom:'-2px', left:'28px', emoji:'💇', label:'헤어' },
                                        { bottom:'-2px', right:'14px', emoji:'🍱', label:'분식' },
                                        { top:'-8px', left:'50%', transform:'translateX(-50%)', emoji:'🥐', label:'베이커리' },
                                    ].map((s, i) => (
                                        <motion.div key={i} initial={{ scale:0 }} whileInView={{ scale:1 }}
                                            transition={{ delay: i * 0.15, type:'spring' }} viewport={{ once:true }}
                                            className="absolute flex flex-col items-center gap-1" style={s}>
                                            <div className="w-11 h-11 bg-white border-2 border-sky-100 rounded-xl shadow-md flex items-center justify-center text-xl">
                                                {s.emoji}
                                            </div>
                                            <span className="text-[9px] font-bold text-gray-500">{s.label}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* 지역 피드 */}
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                                    <Megaphone size={14} className="text-sky-500" />
                                    <p className="font-black text-gray-900 text-sm">지역 실시간 피드</p>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {[
                                        { emoji:'🎉', store:'홍길동 카페', msg:'오늘 오후 2~4시 아메리카노 1+1 이벤트!', time:'방금', color:'bg-amber-50' },
                                        { emoji:'🍕', store:'강남 피자집', msg:'평일 점심 세트 20% 할인 중입니다', time:'12분 전', color:'bg-sky-50' },
                                        { emoji:'💇', store:'수진 헤어샵', msg:'이번 주 남성커트 ₩5,000 특가 진행 중', time:'1시간 전', color:'bg-rose-50' },
                                    ].map((f, i) => (
                                        <motion.div key={i} initial={{ opacity:0, y:6 }} whileInView={{ opacity:1, y:0 }}
                                            transition={{ delay: i * 0.1 }} viewport={{ once:true }}
                                            className={`flex items-start gap-3 px-4 py-3 ${f.color}/40`}>
                                            <span className="text-xl flex-shrink-0">{f.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-gray-800">{f.store}</p>
                                                <p className="text-[11px] text-gray-500 mt-0.5 truncate">{f.msg}</p>
                                            </div>
                                            <span className="text-[10px] text-gray-400 flex-shrink-0">{f.time}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                인기 매장 랭킹 (주문량 TOP 8)
            ══════════════════════════════════════════════ */}
            <section id="popular" className="py-24 px-6 bg-white">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12">
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-bold mb-4">
                            <TrendingUp size={14} /> 인기 매장
                        </span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4 text-balance">지금 가장 뜨거운 매장</h2>
                        <p className="text-gray-500">주문이 가장 많은 인기 매장을 확인하고 빠르게 주문하세요.</p>
                    </div>

                    {popularLoading ? (
                        <div className="flex gap-4 overflow-x-auto pb-4">
                            {[1,2,3,4].map(i => (
                                <div key={i} className="skeleton shrink-0 w-56 h-64 rounded-2xl" />
                            ))}
                        </div>
                    ) : popularStores.length === 0 ? null : (
                        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
                            {popularStores.map((store, i) => {
                                const rankColors = ['bg-amber-500', 'bg-gray-400', 'bg-amber-700', 'bg-gray-300', 'bg-gray-300', 'bg-gray-300', 'bg-gray-300', 'bg-gray-300'];
                                return (
                                    <motion.div key={store.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.06 }}
                                        className="snap-start shrink-0">
                                        <Link to={`/menu/${store.id}`}
                                            className="block w-56 bg-white border border-gray-100 rounded-2xl p-5 hover:border-orange-200 hover:shadow-lg transition-all group h-full">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className={`w-9 h-9 rounded-xl ${rankColors[i] || 'bg-gray-300'} flex items-center justify-center text-white font-black text-sm shadow-sm`}>
                                                    {store.rank}
                                                </div>
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shrink-0 shadow-sm">
                                                    <Store size={18} className="text-white" />
                                                </div>
                                            </div>
                                            <h3 className="font-black text-gray-900 truncate">{store.name}</h3>
                                            {store.address && (
                                                <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{store.address}</p>
                                            )}
                                            <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                                                <span className="text-[11px] text-gray-400 font-bold">
                                                    {store.business_type || '일반'}
                                                </span>
                                                <span className="text-[11px] font-bold text-orange-500 flex items-center gap-1">
                                                    <ShoppingCart size={10} />
                                                    {store.order_count?.toLocaleString()}회
                                                </span>
                                            </div>
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {recentStores.length > 0 && (
            <section className="py-12 px-6 bg-gradient-to-b from-white to-slate-50/50">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-6 px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Clock size={15} className="text-slate-500" />
                            </div>
                            <h2 className="font-black text-gray-900 text-lg">최근 본 매장</h2>
                        </div>
                        <Link to="/stores" className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors">
                            전체보기 <ChevronRight size={14} className="inline" />
                        </Link>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                        {recentStores.map(store => (
                            <Link key={store.id} to={`/menu/${store.id}`}
                                className="snap-start shrink-0 w-40 bg-white border border-gray-100 rounded-xl p-4 hover:border-orange-200 hover:shadow-md transition-all">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center mb-2.5 shadow-sm">
                                    <Store size={16} className="text-white" />
                                </div>
                                <h3 className="font-bold text-gray-900 text-sm truncate">{store.name}</h3>
                                <p className="text-[10px] text-gray-400 mt-1 truncate">{store.business_type || store.address || ''}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
            )}

            {/* ══════════════════════════════════════════════
                매장 위치 (지역·업종·고객위치 검색)
            ══════════════════════════════════════════════ */}
            <div id="locations" className="py-24 px-6 bg-gradient-to-b from-white to-slate-50/50">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-2 px-1 mb-6">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                            <MapPin size={15} className="text-slate-500" />
                        </div>
                        <h2 className="font-black text-gray-900 text-lg">전체 매장 위치</h2>
                    </div>
                    <StoreLocator />
                </div>
            </div>

            {/* ══════════════════════════════════════════════
                이용 방법
            ══════════════════════════════════════════════ */}
            <section id="how-to" className="py-24 px-6 bg-gray-50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">이용 방법</span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4 text-balance">단 4단계로 스마트 매장 완성</h2>
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
                        <h3 className="text-2xl font-black text-gray-900 text-center mb-10 text-balance">고객 입장에서는?</h3>
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
                고객 후기
            ══════════════════════════════════════════════ */}
            <section className="py-24 px-6 bg-white">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">고객 후기</span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4 text-balance">실제 사장님들의 이야기</h2>
                        <p className="text-gray-500 text-lg">전국 소상공인들이 위마켓으로 매장을 바꿨습니다.</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {testimonials.map((t, i) => (
                            <motion.div key={t.name}
                                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                                className="bg-white border border-gray-100 rounded-3xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative overflow-hidden group">
                                {/* 배경 장식 */}
                                <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.06] blur-xl ${
                                    t.color === 'orange' ? 'bg-orange-500' : t.color === 'blue' ? 'bg-blue-500' : 'bg-green-500'
                                }`} />
                                {/* 따옴표 */}
                                <Quote size={28} className={`mb-4 opacity-20 ${
                                    t.color === 'orange' ? 'text-orange-500' : t.color === 'blue' ? 'text-blue-500' : 'text-green-500'
                                }`} />
                                {/* 별점 */}
                                <div className="flex gap-1 mb-4">
                                    {[...Array(t.rating)].map((_, j) => (
                                        <Star key={j} size={15} className="fill-amber-400 text-amber-400" />
                                    ))}
                                </div>
                                {/* 본문 */}
                                <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1">{t.text}</p>
                                {/* 지표 뱃지 */}
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black mb-5 w-fit ${
                                    t.color === 'orange' ? 'bg-orange-50 text-orange-600' :
                                    t.color === 'blue'   ? 'bg-blue-50 text-blue-600' :
                                                           'bg-green-50 text-green-600'
                                }`}>
                                    <TrendingUp size={12} />
                                    {t.stat}
                                </div>
                                {/* 프로필 */}
                                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl border ${
                                        t.color === 'orange' ? 'bg-orange-50 border-orange-100' :
                                        t.color === 'blue'   ? 'bg-blue-50 border-blue-100' :
                                                               'bg-green-50 border-green-100'
                                    }`}>
                                        {t.avatar}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                                        <p className="text-xs text-gray-400">{t.role} · {t.location}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    {/* 사회적 증거 수치 */}
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        className="mt-16 grid sm:grid-cols-3 gap-6">
                        {[
                            { value: '4.9', suffix: '/ 5.0', label: '평균 사용자 평점', note: '1,200+ 리뷰 기준' },
                            { value: '97', suffix: '%', label: '재계약률', note: '최근 12개월 기준' },
                            { value: '14', suffix: '일', label: '무료 체험 기간', note: '카드 등록 불필요' },
                        ].map((s, i) => (
                            <div key={i} className="text-center py-8 px-6 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-4xl font-black text-gray-900 mb-1">
                                    {s.value}<span className="text-2xl text-orange-500">{s.suffix}</span>
                                </p>
                                <p className="font-bold text-gray-700 mb-1">{s.label}</p>
                                <p className="text-xs text-gray-400">{s.note}</p>
                            </div>
                        ))}
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
                            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 text-balance">
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

                    {/* ★ AI 팅커벨 쇼케이스 카드 ★ */}
                    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        className="bg-gradient-to-r from-amber-500/8 to-orange-500/8 border border-amber-500/25 rounded-3xl p-8 mb-6 flex flex-col md:flex-row items-center gap-8">
                        {/* 왼쪽: 설명 */}
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">AI 팅커벨 도우미</span>
                                <span className="text-[10px] font-black text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/15">NEW</span>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3 leading-tight text-balance">
                                24시간 AI 요정이<br />고객을 안내합니다
                            </h3>
                            <p className="text-slate-400 text-sm leading-relaxed mb-5">
                                한국어·영어·일본어·중국어 4개 국어 지원. 날씨와 시간대에 따라 메뉴를 자동 추천하고, 장바구니 담기에 실시간으로 반응하는 AI 안내 캐릭터입니다.
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                {[
                                    { stat:'4개 국어', label:'자동 전환' },
                                    { stat:'+1.8개', label:'추천 후 추가 주문' },
                                    { stat:'64%', label:'추천 전환율' },
                                    { stat:'24%', label:'큰 글씨 활용 (고령층)' },
                                ].map(s => (
                                    <div key={s.label} className="bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
                                        <p className="text-amber-400 font-black text-lg">{s.stat}</p>
                                        <p className="text-slate-500 text-[11px]">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                            <Link to="/menu/demo">
                                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-full font-black text-sm shadow-lg shadow-amber-500/30 cursor-pointer hover:bg-amber-400 transition-colors">
                                    ✨ 팅커벨 메뉴 데모 체험하기
                                </motion.div>
                            </Link>
                        </div>

                        {/* 오른쪽: 요정 일러스트레이션 */}
                        <div className="flex-shrink-0 flex flex-col items-center gap-4">
                            <div className="relative w-32 h-32">
                                {/* 오라 */}
                                <div className="absolute inset-0 rounded-full opacity-60"
                                    style={{ background: 'radial-gradient(circle, rgba(245,159,11,.5) 0%, transparent 70%)' }} />
                                {/* 날개 */}
                                <div className="absolute w-12 h-20 rounded-[60%_40%_70%_70%/70%_70%_60%_60%] opacity-50"
                                    style={{ left: 4, top: 20, background: 'rgba(255,255,255,0.5)' }} />
                                <div className="absolute w-12 h-20 rounded-[40%_60%_70%_70%/70%_70%_60%_60%] opacity-50"
                                    style={{ right: 4, top: 20, background: 'rgba(255,255,255,0.5)' }} />
                                {/* 코어 */}
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl"
                                    style={{ background: 'radial-gradient(circle at 34% 28%, #FFF8E7, #F59E0B 62%, #D97706)', boxShadow: '0 4px 30px rgba(245,159,11,.7)' }}>
                                    <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
                                        <path d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
                                    </svg>
                                </div>
                            </div>
                            {/* 말풍선 */}
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-white font-semibold max-w-[180px] text-center relative">
                                오늘 날씨 좋네요! ☀️<br />
                                <span className="text-amber-400">시그니처 라떼 추천해요!</span>
                                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-l border-t border-slate-700 rotate-45" />
                            </div>
                            <div className="flex gap-2 text-lg">🇰🇷 🇺🇸 🇯🇵 🇨🇳</div>
                        </div>
                    </motion.div>

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
                            <h3 className="text-2xl md:text-3xl font-black text-white mb-3 text-balance">
                                지금 직접 경험해보세요
                            </h3>
                            <p className="text-slate-400 mb-6 leading-relaxed">
                                가입 불필요, 결제 없음. 고객 주문 화면과 사장님 관리 화면을<br className="hidden md:block" />
                                실제 그대로 체험할 수 있습니다.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                                <Link to="/menu/demo">
                                    <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                        className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-orange-500 text-white rounded-full font-black text-base hover:bg-orange-600 transition-colors shadow-xl shadow-orange-500/30 cursor-pointer">
                                        <Play size={18} className="fill-current" />
                                        고객 데모 체험
                                        <ArrowRight size={18} />
                                    </motion.div>
                                </Link>
                                <Link to="/demo/business">
                                    <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                        className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-slate-800 text-white border border-white/15 rounded-full font-black text-base hover:bg-slate-700 transition-colors shadow-xl cursor-pointer">
                                        <Store size={18} />
                                        사업자 데모 체험
                                        <ArrowRight size={18} />
                                    </motion.div>
                                </Link>
                            </div>
                            <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-slate-500 mt-4">
                                <ShieldCheck size={14} className="text-emerald-500" />
                                실제 결제 없음 · 데모 모드
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════
                요금제
            ══════════════════════════════════════════════ */}
            <section id="pricing" className="py-24 px-6 bg-gray-50 relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.4] pointer-events-none"
                    style={{ backgroundImage: 'linear-gradient(135deg, rgba(249,115,22,0.04) 0%, transparent 50%, rgba(99,102,241,0.04) 100%)' }} />
                <div className="max-w-5xl mx-auto relative z-10">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">요금제</span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4 text-balance">합리적인 가격, 강력한 기능</h2>
                        <p className="text-gray-500">결제 수수료 별도 · VAT 포함 가격 · 연간 결제시 2개월 무료</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6 items-center">
                        {pricingPlans.map((plan, i) => (
                            <motion.div key={plan.name}
                                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                                className={`rounded-3xl p-8 flex flex-col relative overflow-hidden ${plan.popular
                                    ? 'bg-gray-900 text-white shadow-2xl md:scale-105'
                                    : 'bg-white border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300'
                                }`}>
                                {plan.popular && (
                                    <>
                                        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-10 blur-2xl"
                                            style={{ background: 'radial-gradient(circle, #f97316, transparent)' }} />
                                        <span className="absolute top-6 right-6 px-3 py-1 bg-orange-500 text-white text-[10px] font-black rounded-full">인기</span>
                                    </>
                                )}
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
                                        ? 'bg-orange-500 text-white hover:bg-orange-400 shadow-lg shadow-orange-500/30'
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
            <section className="py-24 px-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 60%, #eff6ff 100%)' }}>
                <div className="absolute -top-20 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.3) 0%, transparent 70%)' }} />
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                        <div className="flex justify-center gap-1 mb-6">
                            {[...Array(5)].map((_, i) => <Star key={i} size={18} className="fill-amber-400 text-amber-400" />)}
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 leading-tight text-balance">
                            지금 바로 매장을{' '}
                            <span className="text-orange-500">스마트하게</span>{' '}
                            운영하세요
                        </h2>
                        <p className="text-gray-500 text-lg mb-3">14일 무료 체험 · 신용카드 불필요</p>
                        <div className="flex items-center justify-center gap-4 mb-10 text-sm text-gray-400">
                            <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> 설치 불필요</span>
                            <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> 계약 없음</span>
                            <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> 즉시 시작</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/register')}
                                className="px-10 py-4 bg-orange-500 text-white rounded-full font-black text-lg hover:bg-orange-600 transition-colors shadow-xl shadow-orange-200 flex items-center justify-center gap-2">
                                무료로 시작하기 <ArrowRight size={22} />
                            </motion.button>
                            <Link to="/menu/demo">
                                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                                    className="px-10 py-4 border-2 border-gray-200 bg-white text-gray-700 rounded-full font-black text-lg hover:border-orange-300 hover:text-orange-500 transition-colors flex items-center justify-center gap-2 cursor-pointer">
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
                        <Link to="/legal/1/privacy" className="hover:text-gray-600 transition-colors">개인정보처리방침</Link>
                        <Link to="/legal/1/terms" className="hover:text-gray-600 transition-colors">이용약관</Link>
                        <Link to="/legal/1/refund" className="hover:text-gray-600 transition-colors">환불정책</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
