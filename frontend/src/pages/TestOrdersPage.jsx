import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { storesAPI } from '../api/stores';
import { paymentsAPI } from '../api/orders';

export default function TestOrdersPage() {
  const [stores, setStores] = useState([]);
  const [error, setError] = useState('');
  const [cardReady, setCardReady] = useState(false);
  useEffect(() => {
    storesAPI.searchPublic({ limit: 100 }).then(raw => {
      const data = raw?.data || raw;
      setStores(data.stores || (Array.isArray(data) ? data : []));
    }).catch(() => setError('매장 목록을 불러오지 못했습니다. 다시 접속해 주세요.'));
    paymentsAPI.getTestConfig().then(raw => setCardReady((raw?.data || raw)?.enabled === true)).catch(() => {});
  }, []);
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-bold text-orange-700">위마켓 테스트</p>
      <h1 className="mt-2 text-3xl font-black">매장별 주문·결제 테스트</h1>
      <p className="mt-4 leading-7">각 매장의 테스트 1~10 메뉴로 1,000원부터 10,000원까지 확인하세요. 전화번호를 비우고 매장 이용·현금으로 주문하면 결제 대기 상태로 접수됩니다.</p>
      <p role="status" className="my-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6">
        {cardReady ? 'Toss 테스트 카드 결제 사용 가능 · 결제창의 테스트 표시를 확인하세요.' : 'Toss 테스트 카드 결제 설정을 확인할 수 없습니다. 현금 주문을 이용하세요.'}
        <br />준비 완료는 매장 주문 관리에서 전환합니다. 이 화면의 주문은 30초 자동 전환 대상이 아닙니다.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">{stores.map(store => <Link key={store.id} to={`/menu/${store.id}?testMenus=1`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-orange-500">
        <h2 className="font-bold">{store.name}</h2><p className="mt-2 text-sm text-orange-700">테스트 메뉴 열기 →</p>
      </Link>)}</div>
      <Link to="/search" className="mt-6 inline-block rounded-xl bg-orange-700 px-5 py-3 font-bold text-white">매장찾기·주문진행 확인</Link>
    </div>
  </main>;
}
