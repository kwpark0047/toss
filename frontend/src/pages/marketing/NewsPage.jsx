import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, ExternalLink, Calendar, RefreshCw, Search, Building, Store, Menu, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { newsAPI } from '../../api/news';
const SOURCES = ['전체', '소상공인시장진흥공단', '중소벤처기업부', '소상공인연합회', '한국프랜차이즈산업협회'];
export default function NewsPage() {
  const [selectedSource, setSelectedSource] = useState('전체');
  const [page, setPage] = useState(1);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  useEffect(() => {
    document.title = "뉴스 및 소식 | WeMarket";
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const navItems = [{
    label: '기능',
    path: '/features'
  }, {
    label: '요금안내',
    path: '/pricing'
  }, {
    label: '가이드',
    path: '/guides'
  }, {
    label: '푸드트럭',
    path: '/foodtruck'
  }, {
    label: '뉴스/소식',
    path: '/news'
  }];
  const {
    data,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['news', page, selectedSource],
    queryFn: () => newsAPI.getNews({
      page,
      limit: 12,
      source: selectedSource === '전체' ? undefined : selectedSource
    }),
    staleTime: 5 * 60 * 1000
  });
  const getSourceColor = source => {
    switch (source) {
      case '소상공인시장진흥공단':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case '중소벤처기업부':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case '소상공인연합회':
        return 'bg-orange-50 text-orange-600 border-orange-200';
      case '한국프랜차이즈산업협회':
        return 'bg-purple-50 text-purple-600 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };
  const formatDate = dateString => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };
  return <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-md border-b border-slate-200' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = '/'}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Store size={18} className="text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-rose-500">
                WeMarket
              </span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              {navItems.map(item => <a key={item.label} href={item.path} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  {item.label}
                </a>)}
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <a href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  로그인
                </a>
                <a href="/register" className="text-sm font-medium px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10">
                  무료로 시작하기
                </a>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2 text-slate-600 hover:text-slate-900" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && <motion.div initial={{
          opacity: 0,
          height: 0
        }} animate={{
          opacity: 1,
          height: 'auto'
        }} exit={{
          opacity: 0,
          height: 0
        }} className="md:hidden bg-white border-b border-slate-200">
              <div className="px-4 pt-2 pb-6 space-y-1">
                {navItems.map(item => <a key={item.label} href={item.path} className="block px-4 py-3 text-base font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl">
                    {item.label}
                  </a>)}
                <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col gap-2">
                  <a href="/login" className="w-full px-4 py-3 text-center text-base font-medium text-slate-600 hover:text-slate-900 bg-slate-50 rounded-xl">
                    로그인
                  </a>
                  <a href="/register" className="w-full px-4 py-3 text-center text-base font-medium text-white bg-slate-900 rounded-xl shadow-lg shadow-slate-900/20">
                    무료로 시작하기
                  </a>
                </div>
              </div>
            </motion.div>}
        </AnimatePresence>
      </nav>

      <main className="flex-1 pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
              소상공인 뉴스 및 소식
            </h1>
            <p className="text-lg text-slate-600">
              다양한 기관의 주요 지원 사업과 정책 소식을 한눈에 확인하세요.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-8 sticky top-20 z-30">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 sm:pb-0 hide-scrollbar">
                {SOURCES.map(source => <button key={source} onClick={() => {
                setSelectedSource(source);
                setPage(1);
              }} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border ${selectedSource === source ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {source}
                  </button>)}
              </div>
              <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shrink-0">
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">새로고침</span>
              </button>
            </div>
          </div>

          {isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 h-64 animate-pulse">
                  <div className="flex gap-2 mb-4">
                    <div className="w-20 h-6 bg-slate-100 rounded-full" />
                    <div className="w-16 h-6 bg-slate-100 rounded-full" />
                  </div>
                  <div className="w-full h-6 bg-slate-100 rounded-lg mb-2" />
                  <div className="w-3/4 h-6 bg-slate-100 rounded-lg mb-4" />
                  <div className="w-full h-4 bg-slate-50 rounded-lg mb-2" />
                  <div className="w-2/3 h-4 bg-slate-50 rounded-lg" />
                </div>)}
            </div> : isError ? <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
              <Newspaper className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">뉴스를 불러오는 중 오류가 발생했습니다.</p>
              <button onClick={() => refetch()} className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                다시 시도
              </button>
            </div> : data?.items?.length === 0 ? <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">해당 조건의 뉴스가 없습니다.</p>
            </div> : <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data?.items?.map((item, index) => <motion.a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer" initial={{
              opacity: 0,
              y: 20
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              delay: index * 0.05
            }} className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all flex flex-col h-full">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getSourceColor(item.source)} flex items-center gap-1.5`}>
                        <Building size={12} />
                        {item.source}
                      </span>
                      {item.category && <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {item.category}
                        </span>}
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    
                    {item.summary && <p className="text-slate-600 text-sm mb-4 line-clamp-3 flex-1">
                        {item.summary}
                      </p>}
                    
                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {formatDate(item.publishedAt)}
                      </div>
                      <ExternalLink size={14} className="group-hover:text-blue-600 transition-colors" />
                    </div>
                  </motion.a>)}
              </div>

              {data?.totalPages > 1 && <div className="flex justify-center items-center gap-2 mt-12">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    이전
                  </button>
                  <span className="text-sm text-slate-600 font-medium px-4">
                    {page} / {data.totalPages}
                  </span>
                  <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    다음
                  </button>
                </div>}
            </>}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-12 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
              <Store size={16} className="text-slate-400" />
            </div>
            <span className="font-bold text-slate-600">WeMarket</span>
          </div>
          <p className="text-xs font-mono">&copy; 2026 WeMarket Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>;
}
