import { Share2 } from 'lucide-react';
import Icon from '../../components/ui/Icon';

/**
 * 네이버 공유 API 버튼.
 * share.naver.com/web/shareView?url=...&title=... 로 이동하여
 * 블로그/카페/PHOLAR에 공유할 수 있다.
 *
 * @param {string} url       - 공유할 페이지 URL (절대 경로)
 * @param {string} title     - 공유할 제목
 * @param {string} [size]    - 버튼 크기: 'sm' | 'md' (default: 'md')
 * @param {string} [className] - 추가 CSS 클래스
 * @param {function} [onClick] - 클릭 핸들러 (기본: 네이버 공유 창 열기)
 */
export default function NaverShareButton({ url, title, size = 'md', className = '', onClick }) {
  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
      return;
    }
    // 부모 Link 등 이벤트 전파 차단
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const fullUrl = `http://share.naver.com/web/shareView?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
    window.open(fullUrl, '_blank', 'width=600,height=500,noopener,noreferrer');
  };

  const sizeClass = size === 'sm'
    ? 'w-8 h-8 text-xs'
    : 'w-9 h-9 text-sm';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="네이버에 공유"
      title="네이버 블로그/카페에 공유"
      className={`inline-flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors ${sizeClass} ${className}`}
    >
      <span className="font-bold mr-0.5" style={{ fontFamily: 'sans-serif' }}>N</span>
      <Icon icon="Share2" />
    </button>
  );
}
