import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    QrCode, Store, Bell, CreditCard, Clock, BarChart3,
    Users, Smartphone, Check, ArrowRight, Menu, X, ChevronRight,
} from 'lucide-react';

const LandingPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navItems = [
        { label: '기능 소개', href: '#features' },
        { label: '매장 검색', href: '#stores' },
        { label: '이용 방법', href: '#how-to' },
        { label: '요금제', href: '#pricing' },
        { label: '데모 보기', href: '#demo' },
    ];

    const features = [
        { icon: QrCode, title: 'QR 코드 즉시 생성', desc: '테이블마다 고유한 QR 코드를 자동 생성. 출력해서 테이블에 부착하면 바로 사용 가능합니다.', color: 'orange' },
        { icon: Store, title: '매장 통합 관리', desc: '매장 정보, 영업시간, 위치까지 한 곳에서 관리. 지역별 매장 분류도 지원합니다.', color: 'blue' },
        { icon: Users, title: '직원 권한 관리', desc: '마스터 관리자부터 테이블 담당, 주방 직원까지 역할별 권한을 세밀하게 분리합니다.', color: 'green' },
        { icon: Smartphone, title: '웹앱 기반 주문', desc: '앱 설치 없이 브라우저에서 바로 주문. 고객의 진입 장벽을 최소화합니다.', color: 'purple' },
        { icon: Bell, title: '실시간 알림', desc: '주문이 들어오면 담당 직원과 주방에 즉시 알림. 주문 누락을 방지합니다.', color: 'red' },
        { icon: CreditCard, title: '다양한 결제 수단', desc: '현금, 계좌이체는 물론 다양한 간편결제까지 지원합니다.', color: 'indigo' },
        { icon: Clock, title: '대기·예약 관리', desc: '대기 번호 자동 발급, 사전 예약 관리로 고객 경험을 향상시킵니다.', color: 'yellow' },
        { icon: BarChart3, title: '매출 분석', desc: '일별, 월별, 연도별 매출 통계와 결제 수단별 분석 리포트를 제공합니다.', color: 'teal' },
    ];

    const steps = [
        { num: '01', title: '매장 등록', desc: '매장 정보를 입력하고 메뉴를 등록합니다.' },
        { num: '02', title: 'QR 인쇄', desc: '테이블별 QR 코드를 출력해 부착합니다.' },
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
            name: '무료',
            price: '₩0',
            period: '/월',
            features: ['QR 코드 생성', '주문 알림 (웹)', '기본 매출 통계'],
            cta: '무료로 시작',
            popular: false,
        },
        {
            name: '프로',
            price: '₩20,000',
            period: '/월',
            features: ['모든 결제 수단 지원', '실시간 주방 알림', '상세 매출 분석', '대기/예약 관리', '우선 고객 지원'],
            cta: '프로 시작하기',
            popular: true,
        },
        {
            name: '엔터프라이즈',
            price: '₩79,000',
            period: '/월',
            features: ['전용 서버 인프라', 'API 연동 지원', '맞춤형 리포트', '전담 매니저 배정', '광고 노출 우선권'],
            cta: '문의하기',
            popular: false,
        },
    ];

    const iconColorMap = {
        orange: 'bg-orange-100 text-orange-500',
        blue: 'bg-blue-100 text-blue-500',
        green: 'bg-green-100 text-green-500',
        purple: 'bg-purple-100 text-purple-500',
        red: 'bg-red-100 text-red-500',
        indigo: 'bg-indigo-100 text-indigo-500',
        yellow: 'bg-yellow-100 text-yellow-600',
        teal: 'bg-teal-100 text-teal-500',
    };

    const menuItems = [
        { name: '김치찌개', price: '8,000원', badge: '인기' },
        { name: '된장찌개', price: '7,500원', badge: null },
        { name: '불고기 정식', price: '12,000원', badge: '인기' },
        { name: '제육볶음', price: '10,000원', badge: null },
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
                        {navItems.map((item) => (
                            <a key={item.label} href={item.href} className="text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors">
                                {item.label}
                            </a>
                        ))}
                    </nav>

                    <div className="hidden md:flex items-center gap-4">
                        {user ? (
                            <button onClick={() => navigate('/admin')} className="px-5 py-2 bg-orange-500 text-white rounded-full font-bold text-sm hover:bg-orange-600 transition-colors">
                                대시보드
                            </button>
                        ) : (
                            <>
                                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">로그인</Link>
                                <Link to="/register" className="px-5 py-2.5 bg-orange-500 text-white rounded-full font-bold text-sm hover:bg-orange-600 transition-colors shadow-md shadow-orange-100">
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
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden bg-white border-t border-gray-100 px-6 py-6 space-y-4 overflow-hidden"
                        >
                            {navItems.map((item) => (
                                <a key={item.label} href={item.href} className="block text-base font-medium text-gray-700 hover:text-orange-500" onClick={() => setMobileMenuOpen(false)}>
                                    {item.label}
                                </a>
                            ))}
                            <div className="pt-4 border-t border-gray-100 space-y-3">
                                <Link to="/login" className="block text-center py-3 text-gray-700 font-bold border border-gray-200 rounded-full">로그인</Link>
                                <Link to="/register" className="block text-center py-3 bg-orange-500 text-white rounded-full font-bold hover:bg-orange-600 transition-colors">무료로 시작하기</Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* ── 히어로 섹션 ── */}
            <section className="pt-28 pb-20 px-6 bg-gradient-to-br from-orange-50 via-white to-white">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">

                    {/* 왼쪽 텍스트 */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7 }}
                        className="flex-1"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-6">
                            🚀 QR 하나로 완성하는 스마트 매장
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black leading-[1.2] mb-6 text-gray-900">
                            앱 설치 없이<br />
                            <span className="text-orange-500">QR 스캔 한 번</span>으로<br />
                            주문부터 결제까지
                        </h1>
                        <p className="text-lg text-gray-500 mb-8 leading-relaxed max-w-lg">
                            위마켓은 종이 메뉴판과 복잡한 POS를 대체하는 올인원 앱앱 메뉴판 플랫폼입니다. 테이블마다 QR 코드 하나로 주문, 결제, 대기까지 한번에.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/register')}
                                className="flex items-center justify-center gap-2 px-8 py-4 bg-orange-500 text-white rounded-full font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200"
                            >
                                무료로 시작하기 <ArrowRight size={20} />
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/login')}
                                className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-full font-bold text-lg hover:border-orange-300 hover:text-orange-500 transition-colors"
                            >
                                로그인
                            </motion.button>
                        </div>
                        <p className="text-sm text-gray-400 mt-2">
                            서비스가 궁금하신가요?{' '}
                            <Link to="/stores" className="text-orange-500 font-bold hover:text-orange-600 transition-colors">
                                고객 메뉴 데모 보기
                            </Link>
                        </p>

                        {/* 통계 */}
                        <div className="flex gap-10 mt-12 pt-8 border-t border-gray-100">
                            {[
                                { value: '1,000+', label: '등록 매장' },
                                { value: '500만+', label: '누적 주문' },
                                { value: '99%', label: '고객 만족도' },
                            ].map((stat) => (
                                <div key={stat.label}>
                                    <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                                    <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* 오른쪽 스마트폰 목업 */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="flex-1 flex justify-center"
                    >
                        <div className="relative">
                            {/* 폰 외형 */}
                            <div className="w-72 bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
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
                                    <div className="bg-white p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-xl">🏪</div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">맛있는 식당</p>
                                                <p className="text-xs text-gray-400">테이블 5번</p>
                                            </div>
                                        </div>
                                        {/* QR 아이콘 */}
                                        <div className="flex justify-center mb-3">
                                            <div className="w-14 h-14 bg-gray-100 rounded-xl p-1.5 grid grid-cols-3 gap-0.5">
                                                {[1,1,0,1,0,1,0,1,1].map((v, i) => (
                                                    <div key={i} className={`rounded-sm ${v ? 'bg-gray-800' : 'bg-white'}`} />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-center text-[10px] text-gray-400 mb-3">QR 스캔</p>
                                        {/* 메뉴 리스트 */}
                                        {menuItems.map((item) => (
                                            <div key={item.name} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-orange-50 rounded-lg" />
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-xs font-bold text-gray-800">{item.name}</p>
                                                            {item.badge && (
                                                                <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">
                                                                    {item.badge}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-gray-400">{item.price}</p>
                                                    </div>
                                                </div>
                                                <button className="w-7 h-7 bg-orange-500 text-white rounded-full text-sm font-bold flex items-center justify-center">+</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {/* 플로팅 배지 */}
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute -right-12 top-16 bg-white rounded-2xl shadow-xl px-4 py-2.5 border border-gray-100"
                            >
                                <p className="text-[10px] text-gray-400">주문 완료!</p>
                                <p className="text-sm font-bold text-gray-800">김치찌개 x1</p>
                            </motion.div>
                            <motion.div
                                animate={{ y: [0, 8, 0] }}
                                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute -left-12 bottom-20 bg-orange-500 rounded-2xl shadow-xl px-4 py-2.5"
                            >
                                <p className="text-[10px] text-orange-100">결제 완료</p>
                                <p className="text-sm font-bold text-white">₩8,000</p>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── 기능 소개 섹션 ── */}
            <section id="features" className="py-24 px-6 bg-white">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">기능 소개</span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4">매장 운영에 필요한 모든 것</h2>
                        <p className="text-gray-500 text-lg">종이 메뉴판, 복잡한 POS, 예약 수첩… 이제 위마켓 하나로 통합하세요.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, i) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.07 }}
                                viewport={{ once: true }}
                                className="p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-md hover:-translate-y-1 transition-all cursor-default"
                            >
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

            {/* ── 이용 방법 섹션 ── */}
            <section id="how-to" className="py-24 px-6 bg-gray-50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">이용 방법</span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4">단 4단계로 스마트 매장 완성</h2>
                        <p className="text-gray-500 text-lg">복잡한 설정 없이 누구나 쉽게 시작할 수 있습니다.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
                        {steps.map((step, i) => (
                            <motion.div
                                key={step.num}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                viewport={{ once: true }}
                                className="text-center"
                            >
                                <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-orange-200">
                                    {step.num}
                                </div>
                                <h3 className="font-bold text-gray-900 text-lg mb-2">{step.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* 고객 경험 플로우 */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-20 bg-white rounded-3xl p-10 shadow-sm border border-gray-100"
                    >
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
                                    {i < customerFlow.length - 1 && (
                                        <ChevronRight className="text-gray-300 flex-shrink-0 mb-5" size={24} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── 매장 검색 섹션 ── */}
            <section id="stores" className="py-24 px-6 bg-white">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="flex-1"
                    >
                        <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">매장 검색</span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4">내 주변 위마켓 매장</h2>
                        <p className="text-gray-500 text-lg mb-8 leading-relaxed">전국 수천 개의 매장이 이미 위마켓과 함께하고 있습니다. 지금 바로 내 주변의 가장 스마트한 매장을 찾아보세요.</p>
                        <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigate('/stores')}
                            className="flex items-center gap-2 px-8 py-4 bg-orange-500 text-white rounded-full font-bold text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200"
                        >
                            매장 검색하기 <ArrowRight size={20} />
                        </motion.button>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        onClick={() => navigate('/stores')}
                        className="flex-1 bg-gray-50 rounded-3xl border border-gray-100 aspect-square max-w-sm w-full flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow group"
                    >
                        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center text-4xl mb-4 group-hover:scale-110 transition-transform">📍</div>
                        <p className="text-lg font-bold text-gray-800 mb-1">지도에서 매장 찾기</p>
                        <p className="text-sm text-gray-400">전국의 위마켓 매장을 확인하세요</p>
                    </motion.div>
                </div>
            </section>

            {/* ── 요금제 섹션 ── */}
            <section id="pricing" className="py-24 px-6 bg-gray-50">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">요금제</span>
                        <h2 className="text-4xl font-black text-gray-900 mb-4">합리적인 가격, 강력한 기능</h2>
                        <p className="text-gray-500">결제 수수료 별도 · VAT 포함 가격 · 연간 결제시 2개월 무료</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6 items-center">
                        {pricingPlans.map((plan, i) => (
                            <motion.div
                                key={plan.name}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                viewport={{ once: true }}
                                className={`rounded-3xl p-8 flex flex-col ${plan.popular
                                    ? 'bg-gray-900 text-white shadow-2xl md:scale-105'
                                    : 'bg-white border border-gray-200'
                                }`}
                            >
                                <h3 className={`text-lg font-bold mb-1 ${plan.popular ? 'text-gray-300' : 'text-gray-500'}`}>{plan.name}</h3>
                                <div className="flex items-end gap-1 mb-6">
                                    <span className="text-4xl font-black">{plan.price}</span>
                                    <span className={`mb-1 text-sm ${plan.popular ? 'text-gray-400' : 'text-gray-400'}`}>{plan.period}</span>
                                </div>
                                <div className="space-y-3 mb-8 flex-1">
                                    {plan.features.map((f) => (
                                        <div key={f} className="flex items-center gap-2.5">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${plan.popular ? 'bg-orange-500' : 'bg-orange-100'}`}>
                                                <Check size={11} className={plan.popular ? 'text-white' : 'text-orange-500'} />
                                            </div>
                                            <span className={`text-sm ${plan.popular ? 'text-gray-300' : 'text-gray-600'}`}>{f}</span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => navigate('/register')}
                                    className={`w-full py-3.5 rounded-full font-bold transition-all text-sm ${plan.popular
                                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                                        : 'border-2 border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-500'
                                    }`}
                                >
                                    {plan.cta}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA 섹션 ── */}
            <section id="demo" className="py-24 px-6 bg-white">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
                            지금 바로 매장을{' '}
                            <span className="text-orange-500">스마트하게</span>{' '}
                            운영하세요
                        </h2>
                        <p className="text-gray-500 text-lg mb-10">14일 무료 체험 · 신용카드 불필요</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/register')}
                                className="px-10 py-4 bg-orange-500 text-white rounded-full font-black text-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
                            >
                                무료로 시작하기 <ArrowRight size={22} />
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/stores')}
                                className="px-10 py-4 border-2 border-gray-200 text-gray-700 rounded-full font-black text-lg hover:border-orange-300 hover:text-orange-500 transition-colors"
                            >
                                데모 체험하기
                            </motion.button>
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
                            <li><a href="#demo" className="hover:text-orange-500 transition-colors">데모 보기</a></li>
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
