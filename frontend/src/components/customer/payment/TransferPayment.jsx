import { useState } from 'react';
import { ArrowLeft, Copy, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { paymentsAPI } from '../../../api';
import { formatPrice } from '../../../utils/format';

// 은행 코드 매핑
const BANK_CODES = {
  '004': '국민은행',
  '088': '신한은행',
  '020': '우리은행',
  '081': '하나은행',
  '011': '농협은행',
  '003': '기업은행',
  '071': '우체국',
  '090': '카카오뱅크',
  '092': '토스뱅크',
  '089': '케이뱅크'
};

export default function TransferPayment({
  storeAccount,
  totalAmount,
  storeId,
  userIdentifier,
  onComplete,
  onBack
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(t('common.error_loading')); // 임시 에러 메시지
        return;
      }
      setSelectedFile(file);
      setUploadSuccess(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !paymentId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('proof', selectedFile);
      await paymentsAPI.uploadProof(paymentId, formData);
      setUploadSuccess(true);
    } catch (err) {
      console.error('증빙 업로드 실패:', err);
      alert(t('common.error_loading'));
    } finally {
      setUploading(false);
    }
  };

  const handleCopyAccount = async () => {
    if (!storeAccount) return;

    try {
      await navigator.clipboard.writeText(storeAccount.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 API 미지원 시 fallback
      const textArea = document.createElement('textarea');
      textArea.value = storeAccount.account_number;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 토스 송금 딥링크 생성
  const getTossTransferUrl = () => {
    if (!storeAccount) return null;
    return `supertoss://send?bank=${storeAccount.bank_code}&accountNo=${storeAccount.account_number}&amount=${totalAmount}&origin=wemarket`;
  };

  // 결제 요청 생성 (송금 대기 상태)
  const handleRequestTransfer = async () => {
    setLoading(true);
    try {
      const { data } = await paymentsAPI.create({
        store_id: storeId,
        payment_method: 'transfer',
        total_amount: totalAmount,
        point_amount: 0,
        toss_user_key: userIdentifier.toss_user_key,
        phone: userIdentifier.phone
      });

      setPaymentId(data.payment_id);

      // 토스 앱으로 이동
      const tossUrl = getTossTransferUrl();
      if (tossUrl) {
        window.location.href = tossUrl;
      }
    } catch (err) {
      console.error('송금 요청 생성 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 송금 완료 알림
  const handleTransferComplete = () => {
    onComplete({ payment_id: paymentId, status: 'pending_confirmation' });
  };

  if (!storeAccount) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{t('payment.back_to_method')}</span>
        </button>

        <div className="p-6 bg-yellow-50 rounded-xl text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
          <h3 className="font-bold text-lg mb-2">{t('payment.no_account')}</h3>
          <p className="text-gray-600">
            {t('payment.no_account_desc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 뒤로가기 */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>{t('payment.back_to_method')}</span>
      </button>

      {/* 결제 금액 */}
      <div className="p-4 bg-gray-50 rounded-xl text-center">
        <div className="text-sm text-gray-500 mb-1">{t('payment.amount_to_transfer')}</div>
        <div className="text-3xl font-bold text-blue-600">{formatPrice(totalAmount, true)}</div>
      </div>

      {/* 계좌 정보 */}
      <div className="p-4 border-2 border-dashed border-gray-300 rounded-xl space-y-3">
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-1">
            {BANK_CODES[storeAccount.bank_code] || storeAccount.bank_name}
          </div>
          <div className="text-xl font-mono font-bold">
            {storeAccount.account_number}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {t('payment.account_holder', { name: storeAccount.account_holder })}
          </div>
        </div>

        <button
          onClick={handleCopyAccount}
          className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 transition-colors
            ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              {t('payment.copied')}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              {t('payment.copy_account')}
            </>
          )}
        </button>
      </div>

      {/* [신규] 입금 증빙 업로드 섹션 */}
      {paymentId && (
        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-3">
          <div className="flex items-center gap-2 text-orange-800 font-bold text-sm">
            <Check className="w-4 h-4" />
            <span>{t('payment.upload_proof')}</span>
          </div>

          <div className="space-y-2">
            {!uploadSuccess ? (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="proof-upload"
                />
                <label
                  htmlFor="proof-upload"
                  className="block w-full py-3 border-2 border-dashed border-orange-200 rounded-lg text-center cursor-pointer hover:bg-orange-100 transition-colors"
                >
                  {selectedFile ? (
                    <span className="text-sm font-medium text-orange-700">{selectedFile.name}</span>
                  ) : (
                    <span className="text-sm text-orange-500">{t('payment.upload_placeholder')}</span>
                  )}
                </label>

                {selectedFile && !uploadSuccess && (
                  <button
                    onClick={handleFileUpload}
                    disabled={uploading}
                    className="w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-bold disabled:bg-gray-300"
                  >
                    {uploading ? t('payment.uploading') : t('payment.send_proof')}
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-sm font-bold text-green-700">{t('payment.upload_success')}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-orange-600">
            {t('payment.upload_notice')}
          </p>
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800">
        <ul className="space-y-1">
          <li>{t('payment.transfer_notices.check_counter')}</li>
          <li>{t('payment.transfer_notices.same_name')}</li>
          <li>{t('payment.transfer_notices.takes_time')}</li>
        </ul>
      </div>

      {/* 액션 버튼 */}
      <div className="space-y-3">
        {!paymentId ? (
          <button
            onClick={handleRequestTransfer}
            disabled={loading}
            className="w-full py-4 bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:bg-gray-300"
          >
            {loading ? (
              t('payment.uploading') // "처리 중" 대신 "업로드 중" 키 재사용하거나 다른 키 사용
            ) : (
              <>
                <ExternalLink className="w-5 h-5" />
                {t('payment.toss_transfer')}
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleTransferComplete}
            disabled={uploading}
            className="w-full py-4 bg-green-500 text-white rounded-xl font-medium disabled:bg-gray-300"
          >
            {t('payment.transfer_notification')}
          </button>
        )}

        <p className="text-center text-xs text-gray-400">
          {t('payment.toss_app_notice')}
        </p>
      </div>
    </div>
  );
}
