import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronLeft, RefreshCw, ShoppingCart, UtensilsCrossed } from 'lucide-react';
import { productsAPI, categoriesAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';

// 스테이지 상수
const STAGE = {
    SETUP: 'setup',
    BATTLE: 'battle',
    WINNER: 'winner'
};

const MenuWorldCup = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [stage, setStage] = useState(STAGE.SETUP);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [candidates, setCandidates] = useState([]); // 현재 라운드 후보들
    const [nextRound, setNextRound] = useState([]);   // 다음 라운드 진출자들
    const [currentPair, setCurrentPair] = useState([]); // 현재 대결 중인 2개
    const [winner, setWinner] = useState(null);
    const [loading, setLoading] = useState(true);

    // 초기 데이터 로드
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 카테고리 로드
                const catRes = await categoriesAPI.getAll();
                setCategories(catRes.data || []);

                // 전체 상품 로드 (실제로는 카테고리 선택 후 로드하거나 필터링)
                // MVP에서는 일단 전체 로드 후 필터링
                const prodRes = await productsAPI.getAll();
                // 이미지가 있는 상품만 필터링 (월드컵은 이미지가 생명)
                const validProducts = (prodRes.data || []).filter(p => p.image_url && p.is_active);
                setProducts(validProducts);
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // 게임 시작
    const startGame = (categoryId, roundCount) => {
        let pool = products;
        if (categoryId !== 'all') {
            pool = pool.filter(p => p.category_id === categoryId);
        }

        // 랜덤 셔플
        pool = [...pool].sort(() => Math.random() - 0.5);

        // 라운드 수만큼 자르기 (부족하면 최대 개수로)
        const selected = pool.slice(0, Math.min(pool.length, roundCount));

        // 짝수가 아니면 하나 버림 (토너먼트 대진을 위해)
        if (selected.length % 2 !== 0) selected.pop();

        if (selected.length < 2) {
            alert('게임 진행을 위한 메뉴가 부족합니다 (최소 2개)');
            return;
        }

        setCandidates(selected);
        setNextRound([]);
        setWinner(null);
        setStage(STAGE.BATTLE);

        // 첫 대진 설정
        setCurrentPair([selected[0], selected[1]]);
    };

    // 선택 처리
    const handleSelect = (selectedProduct) => {
        const newNextRound = [...nextRound, selectedProduct];
        setNextRound(newNextRound);

        // 현재 대진의 인덱스 계산
        const currentIndex = candidates.indexOf(currentPair[0]);
        // 다음 대진이 있는지 확인
        if (currentIndex + 2 < candidates.length) {
            // 같은 라운드 내 다음 대진
            setCurrentPair([candidates[currentIndex + 2], candidates[currentIndex + 3]]);
        } else {
            // 라운드 종료
            if (newNextRound.length === 1) {
                // 결승 종료 -> 우승
                setWinner(newNextRound[0]);
                setStage(STAGE.WINNER);
            } else {
                // 다음 라운드로 진입 (셔플하여 대진 섞기)
                const nextCandidates = [...newNextRound].sort(() => Math.random() - 0.5);
                setCandidates(nextCandidates);
                setNextRound([]);
                setCurrentPair([nextCandidates[0], nextCandidates[1]]);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-hidden flex flex-col">
            {/* Header */}
            <header className="p-4 flex items-center justify-between z-10">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ChevronLeft size={24} />
                </button>
                <div className="flex items-center gap-2">
                    <Trophy className="text-yellow-400" size={24} />
                    <h1 className="font-bold text-xl">메뉴 이상형 월드컵</h1>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </header>

            {/* Main Content */}
            <main className="flex-1 relative flex items-center justify-center p-4">
                <AnimatePresence mode="wait">
                    {stage === STAGE.SETUP && (
                        <SetupStage
                            key="setup"
                            categories={categories}
                            loading={loading}
                            onStart={startGame}
                        />
                    )}
                    {stage === STAGE.BATTLE && currentPair.length === 2 && (
                        <BattleStage
                            key="battle"
                            pair={currentPair}
                            roundTotal={candidates.length / 2}
                            currentRound={nextRound.length + 1}
                            onSelect={handleSelect}
                        />
                    )}
                    {stage === STAGE.WINNER && winner && (
                        <WinnerStage
                            key="winner"
                            winner={winner}
                            onRestart={() => setStage(STAGE.SETUP)}
                            onOrder={() => navigate('/stores')} // 매장 찾기로 이동
                        />
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

// --- Sub Components ---

const SetupStage = ({ categories, loading, onStart }) => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [roundCount, setRoundCount] = useState(8);

    if (loading) return <div className="text-slate-400">메뉴 로딩 중...</div>;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md space-y-8 text-center"
        >
            <div className="space-y-4">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <UtensilsCrossed size={40} className="text-white" />
                </div>
                <div>
                    <h2 className="text-3xl font-black mb-2">오늘 뭐 먹지?</h2>
                    <p className="text-slate-400">토너먼트로 당신의 취향을 찾아보세요!</p>
                </div>
            </div>

            <div className="space-y-6 bg-slate-900/50 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                {/* 카테고리 선택 */}
                <div className="space-y-3 text-left">
                    <label className="text-sm text-slate-400 font-bold ml-1">카테고리</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`p-3 rounded-xl text-sm font-bold transition-all ${selectedCategory === 'all'
                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            전체 메뉴
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`p-3 rounded-xl text-sm font-bold transition-all ${selectedCategory === cat.id
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 라운드 선택 */}
                <div className="space-y-3 text-left">
                    <label className="text-sm text-slate-400 font-bold ml-1">진행 라운드</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[4, 8, 16].map(num => (
                            <button
                                key={num}
                                onClick={() => setRoundCount(num)}
                                className={`p-3 rounded-xl text-sm font-bold transition-all ${roundCount === num
                                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                            >
                                {num}강
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button
                onClick={() => onStart(selectedCategory, roundCount)}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl font-black text-xl shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all"
            >
                게임 시작
            </button>
        </motion.div>
    );
};

const BattleStage = ({ pair, roundTotal, currentRound, onSelect }) => {
    return (
        <div className="w-full h-full flex flex-col">
            {/* 라운드 인디케이터 */}
            <div className="absolute top-0 left-0 right-0 p-4 pt-20 flex justify-center pointer-events-none z-0">
                <div className="bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-lg font-bold">
                    <span className="text-orange-400">{currentRound}</span> / {roundTotal} 매치
                </div>
            </div>

            {/* 대결 영역 (모바일: 세로, 데스크탑: 가로) */}
            <div className="flex-1 flex flex-col md:flex-row gap-2 relative z-10 pb-10">
                {/* VS 뱃지 */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center z-20 shadow-2xl font-black text-slate-900 border-4 border-slate-950 text-2xl italic">
                    VS
                </div>

                {pair.map((product, idx) => (
                    <div
                        key={product.id}
                        onClick={() => onSelect(product)}
                        className="flex-1 relative group cursor-pointer overflow-hidden rounded-3xl"
                    >
                        {/* 배경 이미지 */}
                        <div className="absolute inset-0 bg-slate-800">
                            <img
                                src={product.image_url || '/placeholder-food.jpg'}
                                alt={product.name}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-100"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        </div>

                        {/* 상품 정보 */}
                        <div className="absolute bottom-0 left-0 right-0 p-8 text-center transition-transform duration-300 group-hover:-translate-y-2">
                            <h3 className="text-2xl md:text-4xl font-black mb-2 shadow-black drop-shadow-md">{product.name}</h3>
                            <p className="text-lg md:text-xl font-medium text-slate-300">
                                {Number(product.price).toLocaleString()}원
                            </p>
                        </div>

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                                선택하기
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const WinnerStage = ({ winner, onRestart, onOrder }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8 max-w-md w-full"
        >
            <div className="relative">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 blur-3xl rounded-full"
                />
                <Trophy className="w-24 h-24 mx-auto text-yellow-400 relative z-10 mb-4 drop-shadow-lg" />
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 relative z-10">
                    최종 우승!
                </h2>
            </div>

            <div className="bg-slate-900/80 p-6 rounded-3xl border border-yellow-500/30 shadow-2xl shadow-yellow-500/10">
                <div className="aspect-square rounded-2xl overflow-hidden mb-6 relative">
                    <img
                        src={winner.image_url}
                        alt={winner.name}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{winner.name}</h3>
                <p className="text-xl text-yellow-400 font-medium">
                    {Number(winner.price).toLocaleString()}원
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={onRestart}
                    className="py-4 bg-slate-800 text-slate-400 rounded-2xl font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                    <RefreshCw size={20} />
                    다시하기
                </button>
                <button
                    onClick={onOrder}
                    className="py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                >
                    <ShoppingCart size={20} />
                    주문하기
                </button>
            </div>
        </motion.div>
    );
};

export default MenuWorldCup;
