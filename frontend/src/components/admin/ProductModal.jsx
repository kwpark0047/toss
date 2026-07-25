import { useState, useEffect } from 'react';
import { productsAPI, storesAPI, aiAPI, uploadsAPI, optionTemplatesAPI } from '../../api';
import { FileText, Image, Tag, Package, X, Sparkles, AlertTriangle, Upload, Info, Check, Star, RefreshCw, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { handleApiError } from '../../utils/apiError';
import { compressImage } from '../../utils/imageCompress';
import { ImagePreview } from './ImagePreview';
import { formatFileSize } from '../../utils/fileUtils';
import { SampleImagePicker } from './SampleImagePicker';
import { VisualOptionEditor } from './VisualOptionEditor';

export function ProductModal({ storeId, categories, product, onClose, onSave }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    category_id: product?.category_id || '',
    price: product?.price || '',
    description: product?.description || '',
    image_url: product?.image_url || '',
    is_sold_out: product?.is_sold_out || 0,
    cooking_time: product?.cooking_time || 5,
    detail_description: product?.detail_description || '',
    detail_images: product?.detail_images || '',
    ingredients: product?.ingredients || '',
    allergens: product?.allergens || '',
    nutrition_info: product?.nutrition_info || '',
    spicy_level: product?.spicy_level || 0,
    is_popular: product?.is_popular || 0,
    is_new: product?.is_new || 0,
    tags: product?.tags || '',
    options: product?.options || '',
    stock_quantity: product?.stock_quantity ?? '',
    low_stock_threshold: product?.low_stock_threshold ?? 5,
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiImageLoading, setAiImageLoading] = useState(false);
  const [storePlan, setStorePlan] = useState('free');
  const [uploading, setUploading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [optionEditorKey, setOptionEditorKey] = useState(0);
  const [imageInfo, setImageInfo] = useState(null);
  const [showSamplePicker, setShowSamplePicker] = useState(false);

  // 인스타그램 카피라이터용 추가 상태 관리
  const [instaCopy, setInstaCopy] = useState('');
  const [showInstaModal, setShowInstaModal] = useState(false);
  const [instaLoading, setInstaLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await optionTemplatesAPI.getByStore(storeId);
        setTemplates(Array.isArray(res) ? res : (res?.data || []));
      } catch { /* 옵션 템플릿 없음 */ }
    };
    loadTemplates();

    (async () => {
      try {
        const res = await storesAPI.getById(storeId);
        const storeData = res?.data || res;
        if (storeData?.plan) setStorePlan(storeData.plan);
      } catch { /* 무시 */ }
    })();
  }, [storeId]);

  const handleFileUpload = async (e, field) => {
    const original = e.target.files[0];
    if (!original) return;

    setUploading(true);

    let file = original;
    let compressResult = null;
    try {
      compressResult = await compressImage(original, { maxDim: 1200, quality: 0.82 });
      file = compressResult.file;
    } catch { /* 압축 실패 시 원본 업로드 (안전) */ }

    let objectUrl = null;
    if (field === 'image_url') {
      objectUrl = URL.createObjectURL(file);
      setForm(prev => ({ ...prev, image_url: objectUrl }));
      const img = new window.Image();
      img.onload = () => {
        const c = compressResult;
        setImageInfo({
          name: file.name,
          size: c?.compressed ? `${formatFileSize(c.originalSize)} → ${formatFileSize(c.size)}` : formatFileSize(file.size),
          width: img.width,
          height: img.height,
          isLarge: file.size > 2 * 1024 * 1024,
          compressed: !!c?.compressed,
        });
      };
      img.src = objectUrl;
    }

    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await uploadsAPI.uploadImage(fd);
      const url = res?.url || res?.data?.url;
      if (url) {
        setForm(prev => ({
          ...prev,
          [field]: field === 'detail_images'
            ? (prev.detail_images ? prev.detail_images + '\n' + url : url)
            : url
        }));
      } else if (objectUrl) {
        setForm(prev => ({ ...prev, image_url: '' }));
      }
    } catch (e) {
      if (objectUrl) setForm(prev => ({ ...prev, image_url: '' }));
      handleApiError(e, '이미지 업로드 실패');
    }
    finally {
      setUploading(false);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  };

  const handleGenerateAI = async () => {
    if (!form.name) { toast.warn('메뉴 이름을 입력해야 AI 설명을 생성할 수 있습니다.'); return; }
    setAiLoading(true);
    try {
      const catName = categories.find(c => c.id === parseInt(form.category_id))?.name || '';
      const res = await aiAPI.describeMenu({ name: form.name, category: catName, description: form.description, price: form.price, image_url: form.image_url });
      if (res?.description) setForm(prev => ({ ...prev, description: res.description }));
    } catch (e) { handleApiError(e, 'AI 설명 생성 중 오류가 발생했습니다'); }
    finally { setAiLoading(false); }
  };

  // 인스타그램 홍보 카피 생성 API 트리거
  const handleGenerateInstagramCopy = async () => {
    if (!form.name) { toast.warn('메뉴 이름을 입력해야 인스타그램 카피를 생성할 수 있습니다.'); return; }
    setInstaLoading(true);
    setInstaCopy('');
    setShowInstaModal(true);
    setCopied(false);
    try {
      const catName = categories.find(c => c.id === parseInt(form.category_id))?.name || '';
      const res = await aiAPI.generateInstagramCopy({
        name: form.name,
        category: catName,
        price: form.price,
        image_url: form.image_url,
        description: form.description
      });
      const text = res?.data?.instagramCopy || res?.instagramCopy || res || '';
      setInstaCopy(text);
    } catch (e) {
      handleApiError(e, '인스타그램 홍보 카피 생성 중 오류가 발생했습니다');
      setShowInstaModal(false);
    } finally {
      setInstaLoading(false);
    }
  };

  const handleGenerateMenuImage = async () => {
    if (!form.name) { toast.warn('메뉴 이름을 입력해야 AI 이미지를 생성할 수 있습니다.'); return; }
    setAiImageLoading(true);
    try {
      const catName = categories.find(c => c.id === parseInt(form.category_id))?.name || '';
      const res = await aiAPI.generateMenuImage({
        store_id: parseInt(storeId),
        name: form.name,
        category: catName,
        description: form.description,
      });
      const url = res?.data?.imageUrl || res?.imageUrl;
      if (url) {
        setForm(prev => ({ ...prev, image_url: url }));
        setImageInfo(null);
        toast.success('AI 이미지가 생성되었습니다.');
      } else {
        toast.warn('이미지를 찾을 수 없습니다. 다시 시도해 주세요.');
      }
    } catch (e) {
      if (e?.response?.status === 403) {
        toast.warn('AI 메뉴 이미지 생성은 유료 구독자 전용입니다. 설정 > 요금제에서 업그레이드해 주세요.');
      } else {
        handleApiError(e, 'AI 이미지 생성 중 오류가 발생했습니다');
      }
    }
    finally { setAiImageLoading(false); }
  };

  const applyTemplate = (tpl) => {
    try {
      setForm(prev => ({ ...prev, options: tpl.options || '[]' }));
      setOptionEditorKey(k => k + 1);
    } catch (e) { handleApiError(e, '템플릿 적용 실패'); }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      let parsedOptions = [];
      try {
        if (typeof form.options === 'string' && form.options.trim()) {
          parsedOptions = JSON.parse(form.options);
        } else if (Array.isArray(form.options)) {
          parsedOptions = form.options;
        }
      } catch {
        toast.error('옵션 JSON 형식이 올바르지 않습니다.');
        setLoading(false);
        return;
      }

      const data = {
        ...form,
        store_id: parseInt(storeId),
        category_id: form.category_id ? parseInt(form.category_id) : null,
        price: parseInt(form.price) || 0,
        cooking_time: parseInt(form.cooking_time) || 5,
        spicy_level: parseInt(form.spicy_level) || 0,
        options: parsedOptions,
        stock_quantity: form.stock_quantity !== '' ? parseInt(form.stock_quantity) : null,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
        is_active: 1
      };

      if (product) {
        await productsAPI.update(product.id, data);
      } else {
        await productsAPI.create(data);
      }
      onSave();
    } catch (e) {
      handleApiError(e, '메뉴 저장 실패');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: '기본 정보', icon: FileText },
    { id: 'detail', label: '상세 & 이미지', icon: Image },
    { id: 'options', label: '옵션 설정', icon: Tag },
    { id: 'stock', label: '재고 관리', icon: Package },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-t-[32px] sm:rounded-[40px] w-full max-w-3xl max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="px-5 py-4 sm:p-10 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight">
              {product ? '메뉴 수정' : '메뉴 등록'}
            </h3>
            <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">상품 정보 설정</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-2xl flex items-center justify-center transition-all flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex px-4 sm:px-10 gap-1 sm:gap-6 border-b border-white/5 bg-white/[0.01] overflow-x-auto scrollbar-hide flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 sm:py-6 flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all relative whitespace-nowrap px-2 sm:px-0 ${activeTab === tab.id ? 'text-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <tab.icon size={13} className="sm:w-4 sm:h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 sm:h-1 bg-orange-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-10 space-y-6 sm:space-y-10">
          {activeTab === 'basic' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* 대표 이미지 및 업로드 수단 (데이터 등록 흐름의 최적화를 위해 최상단으로 전격 고도화 이동) */}
              <div className="space-y-4 bg-white/[0.01] border border-white/5 p-6 rounded-3xl">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">대표 이미지 등록 (최상단)</label>
                  <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold">
                    <Info size={11} />
                    <span>권장: 800×800 · 정방형 · 최대 2MB</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="relative w-full">
                    <Image className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                    <input
                      type="text" value={form.image_url}
                      onChange={(e) => { setForm({ ...form, image_url: e.target.value }); setImageInfo(null); }}
                      placeholder="이미지 URL 또는 파일 업로드"
                      className="w-full h-14 pl-16 pr-6 bg-slate-950 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSamplePicker(true)}
                      className="flex items-center justify-center gap-2 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-xl transition-all font-black text-xs"
                    >
                      <Package size={15} /> 샘플 선택
                    </button>
                    <label className="flex items-center justify-center gap-2 h-12 bg-white text-slate-950 rounded-xl cursor-pointer hover:bg-orange-500 hover:text-white transition-all font-black text-xs">
                      <Upload size={15} />
                      {uploading ? '중...' : '업로드'}
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image_url')} />
                    </label>
                    {storePlan !== 'free' && (
                      <button
                        type="button" onClick={handleGenerateMenuImage} disabled={aiImageLoading}
                        className="col-span-2 xs:col-span-1 flex items-center justify-center gap-2 h-12 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-xl hover:brightness-110 active:scale-95 transition-all font-black text-xs disabled:opacity-50"
                      >
                        <Sparkles size={15} className={aiImageLoading ? 'animate-spin' : ''} />
                        {aiImageLoading ? 'AI 생성 중...' : 'AI 이미지'}
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {imageInfo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold overflow-hidden ${
                        imageInfo.isLarge
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {imageInfo.isLarge ? <AlertTriangle size={14} className="shrink-0" /> : <Check size={14} className="shrink-0" />}
                      <span className="truncate text-slate-300">{imageInfo.name}</span>
                      <span className="text-slate-600 shrink-0">·</span>
                      <span className="shrink-0">{imageInfo.size}</span>
                      <span className="text-slate-600 shrink-0">·</span>
                      <span className="shrink-0">{imageInfo.width}×{imageInfo.height}px</span>
                      {imageInfo.compressed && (
                        <span className="ml-auto shrink-0 text-emerald-400 font-black">✨ 모바일 최적화됨</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {form.image_url && (
                  <ImagePreview
                    src={form.image_url}
                    onRemove={() => { setForm(prev => ({ ...prev, image_url: '' })); setImageInfo(null); }}
                  />
                )}
              </div>

              {/* 메뉴 이름 아래 가격 구조의 입력 폼 정렬 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">메뉴 이름 *</label>
                  <input
                    type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="메뉴 이름을 입력하세요" required
                    className="w-full h-14 sm:h-16 px-5 sm:px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">가격 (원) *</label>
                  <input
                    type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0" required
                    className="w-full h-14 sm:h-16 px-5 sm:px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">카테고리</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full h-14 sm:h-16 px-5 sm:px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white appearance-none text-sm"
                  >
                    <option value="" className="bg-slate-900">카테고리 선택</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-slate-900">{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">조리 시간 (분)</label>
                  <input
                    type="number" value={form.cooking_time} onChange={(e) => setForm({ ...form, cooking_time: e.target.value })}
                    className="w-full h-14 sm:h-16 px-5 sm:px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">메뉴 요약 설명</label>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      type="button" onClick={handleGenerateAI} disabled={aiLoading}
                      className="flex items-center gap-2 text-[10px] font-black text-orange-400 bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-xl transition-all disabled:opacity-50 h-10"
                    >
                      <Sparkles size={14} className={aiLoading ? 'animate-spin' : ''} />
                      {aiLoading ? 'AI 생성 중...' : 'AI 설명'}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      type="button" onClick={handleGenerateInstagramCopy} disabled={instaLoading}
                      className="flex items-center gap-2 text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl transition-all disabled:opacity-50 h-10 shadow-lg shadow-rose-500/5"
                    >
                      <Image size={14} className={instaLoading ? 'animate-spin' : ''} />
                      <span>Instagram 카피</span>
                    </motion.button>
                  </div>
                </div>
                <textarea
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="메뉴의 특징을 간략하게 입력하세요 (AI 자동생성 가능)"
                  rows={3}
                  className="w-full p-6 bg-white/5 border border-white/5 rounded-3xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">태그 (쉼표로 구분)</label>
                <input
                  type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="예) 인기, 추천, 채식, 글루텐프리"
                  className="w-full h-14 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm"
                />
                {form.tags && (
                  <div className="flex flex-wrap gap-2 px-1">
                    {form.tags.split(',').map((t, i) => t.trim() && (
                      <span key={i} className="px-3 py-1 bg-orange-500/10 text-orange-400 rounded-lg text-[11px] font-black border border-orange-500/20">#{t.trim()}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
                {[
                  { id: 'is_popular', label: '인기 메뉴', icon: Star, color: 'text-amber-400' },
                  { id: 'is_new', label: '신메뉴 표시', icon: Flame, color: 'text-blue-400' },
                  { id: 'is_sold_out', label: '품절 표시', icon: AlertTriangle, color: 'text-rose-500' },
                ].map((toggle) => (
                  <button
                    key={toggle.id} type="button"
                    onClick={() => setForm({ ...form, [toggle.id]: form[toggle.id] ? 0 : 1 })}
                    className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all ${form[toggle.id] ? `bg-white/5 border-white/20 ${toggle.color}` : 'bg-transparent border-white/5 text-slate-600 hover:border-white/10'}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <toggle.icon size={16} />
                      <span className="text-[11px] font-black uppercase tracking-tighter">{toggle.label}</span>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 ${form[toggle.id] ? 'bg-current border-transparent' : 'border-current'}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'detail' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">상세 설명</label>
                <textarea
                  value={form.detail_description} onChange={(e) => setForm({ ...form, detail_description: e.target.value })}
                  placeholder="메뉴의 상세한 설명, 특징, 조리법 등을 입력하세요"
                  rows={4}
                  className="w-full p-6 bg-white/5 border border-white/5 rounded-3xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">🌶️ 매운맛 강도 (0~5)</label>
                  <div className="flex items-center gap-4 h-14 px-5 bg-white/5 border border-white/5 rounded-2xl">
                    <input
                      type="range" min="0" max="5" value={form.spicy_level}
                      onChange={(e) => setForm({ ...form, spicy_level: parseInt(e.target.value) })}
                      className="flex-1 accent-orange-500 h-1.5 rounded-full"
                    />
                    <span className="text-white font-black text-lg w-6 text-center">{form.spicy_level}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">알레르기 정보</label>
                  <input
                    type="text" value={form.allergens} onChange={(e) => setForm({ ...form, allergens: e.target.value })}
                    placeholder="예) 땅콩, 밀, 우유, 계란..."
                    className="w-full h-14 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2"><Leaf size={12} /> 원재료</label>
                  <textarea
                    value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
                    placeholder="주요 원재료를 입력하세요"
                    rows={3}
                    className="w-full p-4 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">영양 정보</label>
                  <textarea
                    value={form.nutrition_info} onChange={(e) => setForm({ ...form, nutrition_info: e.target.value })}
                    placeholder="칼로리, 탄수화물, 단백질, 지방 등"
                    rows={3}
                    className="w-full p-4 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'options' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {templates.length > 0 && (
                <div className="p-6 bg-orange-500/5 border border-orange-500/10 rounded-[24px] space-y-4">
                  <div className="flex items-center gap-3">
                    <Settings className="text-orange-500" size={18} />
                    <h4 className="text-white font-black text-sm">옵션 템플릿 적용</h4>
                    <span className="text-[10px] font-black text-orange-500/50 uppercase ml-auto">{templates.length}개 사용 가능</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {templates.map(t => (
                      <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[11px] font-black border border-white/5 transition-all">
                        {t.name} 적용
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-4 px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">옵션 그룹 설정</label>
                  <span className="text-[10px] text-slate-600 font-bold">추가금은 기본 가격에 더해집니다</span>
                </div>
                <VisualOptionEditor
                  key={optionEditorKey}
                  value={form.options}
                  onChange={(val) => setForm(prev => ({ ...prev, options: val }))}
                />
              </div>
            </div>
          )}

          {activeTab === 'stock' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[28px]">
                <div className="flex items-center gap-3 mb-6">
                  <Package className="text-blue-400" size={20} />
                  <h4 className="text-white font-black">재고 수량 관리</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">현재 재고 수량</label>
                    <input
                      type="number" value={form.stock_quantity}
                      onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                      placeholder="비워두면 무제한"
                      className="w-full h-14 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-blue-500/50 transition-all font-bold text-white placeholder:text-slate-700 text-sm"
                    />
                    <p className="text-[10px] text-slate-600 font-medium px-2">비워두면 재고 제한 없이 주문 가능</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">부족 알림 기준 (개)</label>
                    <input
                      type="number" value={form.low_stock_threshold}
                      onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                      placeholder="5"
                      className="w-full h-14 px-6 bg-white/5 border border-white/5 rounded-2xl outline-none focus:border-blue-500/50 transition-all font-bold text-white text-sm"
                    />
                    <p className="text-[10px] text-slate-600 font-medium px-2">이 수량 이하일 때 부족 경보 알림 발송</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-800/50 rounded-[24px] border border-white/5">
                <p className="text-sm text-slate-400 font-medium leading-relaxed">
                  재고 이력 및 입출고 조정은 <strong className="text-white">재고 관리 메뉴</strong>에서 상세하게 처리할 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 sm:p-10 border-t border-white/5 bg-white/[0.01] flex gap-3 flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
          <button type="button" onClick={onClose} className="flex-1 h-12 sm:h-16 bg-white/5 text-slate-400 rounded-2xl font-black text-sm hover:bg-white/10 transition-all">
            취소
          </button>
          <button
            onClick={handleSubmit} disabled={loading}
            className="flex-[3] h-12 sm:h-16 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? '저장 중...' : product ? '메뉴 수정' : '메뉴 등록'}
          </button>
        </div>
      </motion.div>

      {/* 인스타그램 카피라이터 결과 모달 다이얼로그 카드 */}
      <AnimatePresence>
        {showInstaModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[110] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-[32px] p-6 sm:p-8 max-w-lg w-full flex flex-col gap-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-rose-400 animate-pulse" size={20} />
                  <h4 className="text-white font-black text-lg">AI 인스타그램 카피라이터</h4>
                </div>
                <button 
                  onClick={() => setShowInstaModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[50vh] p-4 bg-slate-950 border border-white/5 rounded-2xl">
                {instaLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-rose-400">
                    <RefreshCw className="animate-spin" size={24} />
                    <p className="text-xs font-bold animate-pulse text-center leading-relaxed">
                      20대 여성의 취향을 저격할<br />
                      사랑스러운 홍보 피드를 카피라이팅하는 중... ✨
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans select-text">{instaCopy || '카피라이팅이 성공적으로 구성되지 못했습니다.'}</p>
                )}
              </div>

              {!instaLoading && instaCopy && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(instaCopy);
                      setCopied(true);
                      toast.success('클립보드에 인스타그램 카피가 복사되었습니다!');
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`flex-1 py-3.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                      copied ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 hover:bg-rose-600 text-white'
                    }`}
                  >
                    {copied ? '✓ 복사 완료!' : '클립보드 원클릭 복사'}
                  </button>
                  <button
                    onClick={() => handleGenerateInstagramCopy()}
                    className="px-5 py-3.5 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:text-slate-200 transition-all active:scale-95"
                  >
                    재생성
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showSamplePicker && (
        <SampleImagePicker
          onSelect={(url) => { setForm(prev => ({ ...prev, image_url: url })); setImageInfo(null); setActiveTab('basic'); }}
          onClose={() => setShowSamplePicker(false)}
        />
      )}
    </div>
  );
}
