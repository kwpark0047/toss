import { useEffect } from 'react';

const DEFAULT_TITLE = '위마켓 — QR 메뉴 & 스마트 매장 관리';
const DEFAULT_DESCRIPTION = 'WeMarket은 QR 주문, 실시간 주방 관리, 재고 관리, 매출 분석을 통합한 스마트 매장 관리 솔루션입니다.';

export function useSEO({ title, description }) {
  useEffect(() => {
    const prevTitle = document.title;
    const prevDescription = document.querySelector('meta[name="description"]')?.content;

    if (title) {
      document.title = title;
    }
    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = description;
    }

    return () => {
      if (prevTitle !== undefined) document.title = prevTitle;
      if (prevDescription !== undefined) {
        let metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.content = prevDescription;
      }
    };
  }, [title, description]);
}
