import { useEffect, useState } from 'react';
import { paymentsAPI } from '../../api';

export default function PrivatePaymentProof({ paymentId }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let disposed = false;
    let objectUrl;
    paymentsAPI
      .getProof(paymentId)
      .then(async (blob) => {
        let result;
        if (blob.type.includes('json')) {
          const body = JSON.parse(await blob.text());
          result = body.data?.url;
          if (!result?.startsWith('https://')) throw new Error('증빙 주소를 확인할 수 없습니다.');
        } else {
          objectUrl = URL.createObjectURL(blob);
          result = objectUrl;
        }
        if (!disposed) {
          setUrl(result);
          setError('');
        }
      })
      .catch(() => {
        if (!disposed) setError('증빙을 조회하지 못했습니다. 다시 조회해 주세요.');
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paymentId, reload]);
  return (
    <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
      <h3 className="mb-2 font-semibold text-orange-800">비공개 입금 증빙</h3>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt="입금 증빙"
            className="max-h-64 w-full object-contain"
            onError={() => setError('조회 시간이 만료되었습니다. 다시 조회해 주세요.')}
          />
        </a>
      )}
      <button
        type="button"
        onClick={() => setReload((v) => v + 1)}
        className="mt-2 min-h-11 text-sm font-semibold text-orange-800 underline"
      >
        증빙 다시 조회
      </button>
    </div>
  );
}
