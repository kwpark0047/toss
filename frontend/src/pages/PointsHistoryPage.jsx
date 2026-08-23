import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Star, ChevronDown, Filter, ArrowUpDown } from 'lucide-react';
import { usePoints } from '@/hooks/usePoints';
import Icon from '../components/ui/Icon';

export default function PointsHistoryPage() {
  const { t } = useTranslation();
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const { points, history, loading, fetchHistory, walletLookup } = usePoints({});

  useEffect(() => {
    if (storeId) {
      walletLookup(parseInt(storeId));
    }
  }, [storeId, walletLookup]);

  useEffect(() => {
    fetchHistory({
      store_id: storeId ? parseInt(storeId) : undefined,
      type: filter !== 'all' ? filter : undefined,
      limit: 50,
      offset: 0,
    });
  }, [filter, storeId, fetchHistory]);

  const getTypeLabel = (type) => {
    const labels = {
      earn: t('points.type_earn'),
      use: t('points.type_use'),
      cancel_earn: t('points.type_cancel_earn'),
      cancel_use: t('points.type_cancel_use'),
    };
    return labels[type] || type;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'earn': return <span className="text-green-500">▲</span>;
      case 'use': return <span className="text-orange-500">▼</span>;
      case 'cancel_earn': return <span className="text-red-500">▲</span>;
      case 'cancel_use': return <span className="text-blue-500">▼</span>;
      default: return <span>●</span>;
    }
  };

  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  if (loading && !history.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600">
            <ChevronLeft className="w-6 h-6" />
            <span className="font-medium">{t('points.history_title')}</span>
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>{t('common.filter')}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-2">
            {['all', 'earn', 'use', 'cancel_earn', 'cancel_use'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {f === 'all' ? t('common.all') : t(`points.type_${f}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 포인트 요약 카드 */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
                <Icon icon="Star" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('points.current_balance')}</p>
                <p className="text-2xl font-bold text-gray-900">{(points?.total_points || 0).toLocaleString()}P</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs text-green-600 font-medium">{t('points.total_earned')}</p>
                <p className="font-bold text-green-700">{(points?.lifetime_earned || 0).toLocaleString()}P</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="text-xs text-orange-600 font-medium">{t('points.total_used')}</p>
                <p className="font-bold text-orange-700">{(points?.lifetime_used || 0).toLocaleString()}P</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600 font-medium">{t('points.expiring_soon')}</p>
                <p className="font-bold text-blue-700">0P</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 내역 리스트 */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{t('points.transaction_history')}</h2>
          <button onClick={handleSortToggle} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowUpDown className="w-4 h-4" />
            <span>{sortOrder === 'desc' ? t('common.latest_first') : t('common.oldest_first')}</span>
          </button>
        </div>

        {history.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Icon icon="Star" />
            <p className="text-gray-500 text-lg">{filter === 'all' ? t('points.no_history') : t('points.no_history_filter')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('points.history_empty_hint')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
            {history
              .sort((a, b) => sortOrder === 'desc'
                ? new Date(b.created_at) - new Date(a.created_at)
                : new Date(a.created_at) - new Date(b.created_at))
              .map((tx) => (
                <div key={tx.id} className="px-4 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        tx.type === 'earn' ? 'bg-green-100' :
                        tx.type === 'use' ? 'bg-orange-100' :
                        tx.type.startsWith('cancel') ? 'bg-red-100' : 'bg-gray-100'
                      }`}>
                        {getTypeIcon(tx.type)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{getTypeLabel(tx.type)}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-2">
                          {tx.stores?.name && <span>{tx.stores.name}</span>}
                          <span className="text-gray-400">{new Date(tx.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}P
                      </p>
                      <p className="text-xs text-gray-500">잔액: {tx.balance_after.toLocaleString()}P</p>
                    </div>
                  </div>
                  {tx.description && <p className="text-xs text-gray-500 mt-1">{tx.description}</p>}
                </div>
              ))}
            </div>
        )}
      </div>
    </div>
  );
}