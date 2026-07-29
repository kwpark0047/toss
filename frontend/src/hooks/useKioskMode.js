import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * useKioskMode — 태블릿/키오스크 전용 모드
 *
 * URL 쿼리 `?kiosk=1`로 활성화. 활성 시:
 *  - <body>에 `kiosk-mode` 클래스 부착 → 터치 최적화 스타일(index.css) 적용
 *  - 최초 사용자 제스처(터치/클릭)에서 전체화면 자동 진입 (Fullscreen API는
 *    사용자 상호작용을 요구하므로 즉시 호출 불가)
 *  - 우클릭 컨텍스트 메뉴 차단(키오스크 오조작 방지)
 *
 * @returns {{ isKiosk: boolean, isFullscreen: boolean, enterFullscreen: () => void }}
 */
export function useKioskMode() {
  const [searchParams] = useSearchParams();
  const isKiosk = searchParams.get('kiosk') === '1';
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {}); // 사용자가 거부하거나 미지원이면 무시
    }
  }, []);

  useEffect(() => {
    if (!isKiosk) return;

    document.body.classList.add('kiosk-mode');

    // 최초 상호작용 시 전체화면 진입 (1회)
    const onFirstInteract = () => {
      enterFullscreen();
      window.removeEventListener('pointerdown', onFirstInteract);
    };
    window.addEventListener('pointerdown', onFirstInteract, { once: true });

    // 전체화면 상태 동기화
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);

    // 오조작 방지: 우클릭 컨텍스트 메뉴 차단
    const onContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', onContextMenu);

    return () => {
      document.body.classList.remove('kiosk-mode');
      window.removeEventListener('pointerdown', onFirstInteract);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, [isKiosk, enterFullscreen]);

  return { isKiosk, isFullscreen, enterFullscreen };
}

export default useKioskMode;
