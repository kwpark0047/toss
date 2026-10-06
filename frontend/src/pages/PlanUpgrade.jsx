import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { plansAPI } from '../api';
import SubscriptionBilling from '../components/admin/SubscriptionBilling';

export default function PlanUpgrade() {
  const { storeId } = useParams();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    plansAPI.getActive().then((result) => { if (active) setPlans(result.data || []); })
      .catch(() => { if (active) setError('요금제를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'); });
    return () => { active = false; };
  }, []);
  return <main className="mx-auto max-w-6xl p-4 sm:p-6">
    <header className="mb-6"><h1 className="text-2xl font-bold text-white">구독 요금제</h1>
      <p className="mt-2 text-slate-300">매장에 맞는 요금제를 선택하고 청구 내역과 자동 갱신을 관리하세요.</p></header>
    {error && <p role="alert" className="mb-4 text-red-300">{error}</p>}
    <SubscriptionBilling storeId={storeId} plans={plans} />
  </main>;
}
