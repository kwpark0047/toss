import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Save, AlertCircle, Clock, Star } from 'lucide-react';
import { pointsAPI } from '@/api';
import { toast } from 'react-toastify';

const DEFAULT_SETTINGS = {
  is_enabled: true,
  earn_rate: 1.0,
  min_earn_amount: 1000,
  max_use_rate: 100,
  min_use_points: 100,
  expiry_days: 365,
};

export default function PointsSettingsPage() {
  const { t } = useTranslation();
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (storeId) {
      pointsAPI.getStoreSettings(parseInt(storeId))
        .then(res => {
          setSettings(res?.data || DEFAULT_SETTINGS);
          setLoading(false);
        })
        .catch(() => {
          setSettings(DEFAULT_SETTINGS);
          setLoading(false);
        });
    }
  }, [storeId]);

  const validateSettings = (s) => {
    const newErrors = {};
    if (s.earn_rate < 0 || s.earn_rate > 100) newErrors.earn_rate = t('settings.earn_rate_range');
    if (s.min_earn_amount < 0) newErrors.min_earn_amount = t('settings.min_earn_positive');
    if (s.max_use_rate < 0 || s.max_use_rate > 100) newErrors.max_use_rate = t('settings.max_use_range');
    if (s.min_use_points < 0) newErrors.min_use_points = t('settings.min_use_positive');
    if (s.expiry_days < 1 || s.expiry_days > 3650) newErrors.expiry_days = t('settings.expiry_days_range');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleSave = async () => {
    if (!validateSettings(settings)) return;
    setSaving(true);
    try {
      await pointsAPI.updateStoreSettings(parseInt(storeId), settings);
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('settings.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const previewEarn = (amount) => {
    if (!settings) return 0;
    if (amount < settings.min_earn_amount) return 0;
    return Math.floor(amount * (settings.earn_rate / 100));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600">
            <ChevronLeft className="w-6 h-6" />
            <span className="font-medium">{t('settings.points_title')}</span>
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 활성화 토글 */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">{t('settings.points_enabled')}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{t('settings.points_enabled_desc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.is_enabled}
                onChange={(e) => handleChange('is_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>
        </div>

        {/* 적립 설정 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            {t('settings.earn_settings')}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.earn_rate')} (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={settings.earn_rate}
                onChange={e => handleChange('earn_rate', parseFloat(e.target.value) || 0)}
                className={`w-full px-4 py-3 border rounded-xl ${errors.earn_rate ? 'border-red-300' : 'border-gray-200'} focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none`}
              />
              {errors.earn_rate && <p className="text-xs text-red-500 mt-1">{errors.earn_rate}</p>}
              <p className="text-xs text-gray-500 mt-1">{t('settings.earn_rate_help')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.min_earn_amount')} (원)</label>
              <input
                type="number"
                step="100"
                min="0"
                value={settings.min_earn_amount}
                onChange={e => handleChange('min_earn_amount', parseInt(e.target.value) || 0)}
                className={`w-full px-4 py-3 border rounded-xl ${errors.min_earn_amount ? 'border-red-300' : 'border-gray-200'} focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none`}
              />
              {errors.min_earn_amount && <p className="text-xs text-red-500 mt-1">{errors.min_earn_amount}</p>}
              <p className="text-xs text-gray-500 mt-1">{t('settings.min_earn_amount_help')}</p>
            </div>
          </div>

          {/* 적립 시뮬레이션 */}
          <div className="bg-amber-50 rounded-xl p-4">
            <h4 className="font-medium text-amber-800 mb-3">{t('settings.earn_preview')}</h4>
            <div className="grid grid-cols-3 gap-3">
              {[10000, 30000, 50000].map(amt => (
                <div key={amt} className="bg-white rounded-lg p-3 text-center border border-amber-100">
                  <p className="text-xs text-amber-700 font-medium">결제 {amt.toLocaleString()}원</p>
                  <p className="text-lg font-bold text-amber-600">{previewEarn(amt).toLocaleString()}P 적립</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 사용 설정 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {t('settings.use_settings')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.max_use_rate')} (%)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={settings.max_use_rate}
                onChange={e => handleChange('max_use_rate', parseInt(e.target.value) || 0)}
                className={`w-full px-4 py-3 border rounded-xl ${errors.max_use_rate ? 'border-red-300' : 'border-gray-200'} focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none`}
              />
              {errors.max_use_rate && <p className="text-xs text-red-500 mt-1">{errors.max_use_rate}</p>}
              <p className="text-xs text-gray-500 mt-1">{t('settings.max_use_rate_help')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.min_use_points')} (P)</label>
              <input
                type="number"
                step="10"
                min="0"
                value={settings.min_use_points}
                onChange={e => handleChange('min_use_points', parseInt(e.target.value) || 0)}
                className={`w-full px-4 py-3 border rounded-xl ${errors.min_use_points ? 'border-red-300' : 'border-gray-200'} focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none`}
              />
              {errors.min_use_points && <p className="text-xs text-red-500 mt-1">{errors.min_use_points}</p>}
              <p className="text-xs text-gray-500 mt-1">{t('settings.min_use_points_help')}</p>
            </div>
          </div>

          {/* 사용 시뮬레이션 */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h4 className="font-medium text-blue-800 mb-3">{t('settings.use_preview')}</h4>
            <div className="grid grid-cols-3 gap-3">
              {[10000, 30000, 50000].map(amt => (
                <div key={amt} className="bg-white rounded-lg p-3 text-center border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium">결제 {amt.toLocaleString()}원</p>
                  <p className="text-lg font-bold text-blue-600">최대 {Math.floor(amt * (settings.max_use_rate / 100)).toLocaleString()}P 사용</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-2">최소 보유 {settings.min_use_points.toLocaleString()}P 필요</p>
          </div>
        </div>

        {/* 만료 설정 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-500" />
            {t('settings.expiry_settings')}
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.expiry_days')} (일)</label>
            <input
              type="number"
              step="1"
              min="1"
              max="3650"
              value={settings.expiry_days}
              onChange={e => handleChange('expiry_days', parseInt(e.target.value) || 365)}
              className={`w-full px-4 py-3 border rounded-xl ${errors.expiry_days ? 'border-red-300' : 'border-gray-200'} focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none`}
            />
            {errors.expiry_days && <p className="text-xs text-red-500 mt-1">{errors.expiry_days}</p>}
            <p className="text-xs text-gray-500 mt-1">{t('settings.expiry_days_help')}</p>
          </div>

          <div className="bg-red-50 rounded-xl p-4">
            <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {t('settings.expiry_warning')}
            </h4>
            <p className="text-sm text-red-700">{t('settings.expiry_warning_desc')}</p>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm py-4 px-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 disabled:opacity-50 transition-all"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {t('common.saving')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Save className="w-5 h-5" />
                {t('common.save')}
              </span>
            )}
          </button>
        </div>
</div>
     </div>
   );
 }