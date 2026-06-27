import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, X, Send, Store, CheckCircle2, ArrowLeft } from 'lucide-react';
import { formatPrice } from '../../utils/format';

const demoCategories = [
  { id: 1, name: '시그니처' },
  { id: 2, name: '커피' },
  { id: 3, name: '논커피' },
  { id: 4, name: '에이드' },
  { id: 5, name: '디저트' }
];

const demoProducts = [
  { id: 1, category_id: 1, name: '위마켓 시그니처 라떼', price: 6500, description: '달콤한 캐러멜과 에스프레소의 완벽한 조화' },
  { id: 2, category_id: 1, name: '오렌지 블라썸', price: 7000, description: '상큼한 오렌지와 꽃향기가 어우러진 시그니처 음료' },
  { id: 3, category_id: 2, name: '아메리카노', price: 4500, description: '깊고 진한 에스프레소의 풍미' },
  { id: 4, category_id: 2, name: '카페라떼', price: 5000, description: '부드러운 우유와 에스프레소의 조화' },
  { id: 5, category_id: 2, name: '바닐라 라떼', price: 5500, description: '달콤한 바닐라 시럽이 들어간 라떼' },
  { id: 6, category_id: 3, name: '초코 라떼', price: 5500, description: '진한 초콜릿과 우유의 달콤한 조화' },
  { id: 7, category_id: 3, name: '그린티 라떼', price: 5500, description: '녹차의 깊은 풍미를 담은 라떼' },
  { id: 8, category_id: 4, name: '자몽 에이드', price: 5500, description: '상큼한 자몽이 가득한 에이드' },
  { id: 9, category_id: 4, name: '레몬 에이드', price: 5000, description: '시원하고 상큼한 레몬 에이드' },
  { id: 10, category_id: 5, name: '티라미수', price: 6500, description: '부드럽고 진한 마스카포네 티라미수' },
  { id: 11, category_id: 5, name: '치즈케이크', price: 6000, description: '뉴욕 스타일의 진한 치즈케이크' }
];

const MenuDemo = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [orderForm, setOrderForm] = useState({ customer_name: '', notes: '' });


  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) return prev.map((item) => item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { product_id: product.id, product_name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) => prev.map((item) => item.product_id === productId ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  };

  const getTotalAmount = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const getTotalItems = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleOrder = () => {
    if (cart.length === 0) return;
    const orderNumber = 'DEMO-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    setOrderSuccess({ order_number: orderNumber, total_amount: getTotalAmount() });
    setCart([]);
    setShowCart(false);
  };

  const filteredProducts = selectedCategory ? demoProducts.filter((p) => p.category_id === selectedCategory) : demoProducts;

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 p-4">
        <div className="glass rounded-3xl shadow-card p-8 max-w-md w-full text-center">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center shadow-lg"><CheckCircle2 className="w-12 h-12 text-white" /></div>
          <h2 className="text-2xl font-bold text-navy-900 mb-2">주문 완료! (데모)</h2>
          <div className="inline-block px-4 py-2 bg-navy-100 rounded-full mb-4"><span className="text-navy-600 text-sm">주문번호</span><span className="text-navy-900 font-bold ml-2">{orderSuccess.order_number}</span></div>
          <p className="text-3xl font-bold text-primary-600 mb-8">{formatPrice(orderSuccess.total_amount, true)}</p>
          <div className="space-y-3">
            <button onClick={() => setOrderSuccess(null)} className="w-full py-4 btn-primary text-white rounded-2xl font-medium text-lg">추가 주문하기</button>
            <Link to="/" className="block w-full py-4 bg-navy-100 text-navy-700 rounded-2xl font-medium text-lg hover:bg-navy-200 transition-colors">홈으로 돌아가기</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50 pb-28">
      <div className="glass sticky top-0 z-10 shadow-soft">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-10 h-10 rounded-xl bg-navy-100 flex items-center justify-center hover:bg-navy-200 transition-colors"><ArrowLeft className="w-5 h-5 text-navy-600" /></Link>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg"><Store className="w-6 h-6 text-white" /></div>
            <div><h1 className="text-xl font-bold text-navy-900">위마켓 카페</h1><p className="text-sm text-navy-500 flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-primary-400"></span>데모 매장</p></div>
          </div>
        </div>
        <div className="flex overflow-x-auto px-5 pb-4 gap-2" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setSelectedCategory(null)} className={'px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ' + (selectedCategory === null ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg' : 'bg-white text-navy-600 shadow-soft hover:shadow-card')}>전체</button>
          {demoCategories.map((cat) => (<button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={'px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ' + (selectedCategory === cat.id ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg' : 'bg-white text-navy-600 shadow-soft hover:shadow-card')}>{cat.name}</button>))}
        </div>
      </div>

      <div className="p-5 grid gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-2xl shadow-soft p-4 flex gap-4 card-hover">
            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center"><Store className="w-8 h-8 text-primary-400" /></div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-navy-900 truncate">{product.name}</h3>
              <p className="text-sm text-navy-400 mt-1">{product.description}</p>
              <p className="text-primary-600 font-bold text-lg mt-2">{formatPrice(product.price, true)}</p>
            </div>
            <button onClick={() => addToCart(product)} className="self-center w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95"><Plus size={24} /></button>
          </div>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 glass border-t border-white/50">
          <button onClick={() => setShowCart(true)} className="w-full py-4 btn-primary text-white rounded-2xl flex items-center justify-center gap-3 shadow-lg">
            <div className="relative"><ShoppingCart size={24} /><span className="absolute -top-2 -right-2 w-5 h-5 bg-white text-primary-600 text-xs font-bold rounded-full flex items-center justify-center">{getTotalItems()}</span></div>
            <span className="font-medium">장바구니 보기</span>
            <span className="font-bold text-lg">{formatPrice(getTotalAmount(), true)}</span>
          </button>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/90 backdrop-blur-lg p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-navy-900">장바구니</h2>
              <button onClick={() => setShowCart(false)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"><X size={20} className="text-navy-600" /></button>
            </div>
            <div className="p-5 space-y-4">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between bg-gray-50 rounded-2xl p-4">
                  <div className="flex-1 min-w-0"><p className="font-bold text-navy-900 truncate">{item.product_name}</p><p className="text-sm text-primary-600 font-medium">{formatPrice(item.price, true)}</p></div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQuantity(item.product_id, -1)} className="w-9 h-9 rounded-full bg-white shadow-soft flex items-center justify-center"><Minus size={16} className="text-navy-600" /></button>
                    <span className="w-8 text-center font-bold text-navy-900">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product_id, 1)} className="w-9 h-9 rounded-full bg-white shadow-soft flex items-center justify-center"><Plus size={16} className="text-navy-600" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-100 space-y-3">
              <input type="text" placeholder="이름 (선택)" value={orderForm.customer_name} onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none" />
              <textarea placeholder="요청사항 (선택)" value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} rows={2} className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all resize-none outline-none" />
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50">
              <div className="flex justify-between items-center mb-4"><span className="text-navy-600">총 결제금액</span><span className="text-2xl font-bold text-primary-600">{formatPrice(getTotalAmount(), true)}</span></div>
              <button onClick={handleOrder} className="w-full py-4 btn-primary text-white rounded-2xl flex items-center justify-center gap-2 font-medium text-lg shadow-lg"><Send size={20} />주문하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuDemo;
