/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, ZoomIn, ZoomOut } from 'lucide-react';
import { bizLabel } from '../utils/businessType';

const KakaoMap = ({ stores, onStoreSelect, selectedStore }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [error, setError] = useState(null);

  const initializeMap = useCallback(() => {
    try {
      const container = mapRef.current;
      const options = {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 4
      };
      const map = new window.kakao.maps.Map(container, options);
      mapInstanceRef.current = map;

      // 커스텀 줌 컨트롤은 UI로 직접 구현되어 있으므로 기본 컨트롤은 생략 가능
      setIsMapLoaded(true);
    } catch (err) {
      console.error(err);
      setError('지도를 초기화하는 중 오류가 발생했습니다.');
    }
  }, []);

  const updateMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const bounds = new window.kakao.maps.LatLngBounds();

    stores.forEach(store => {
      if (!store.latitude || !store.longitude) return;

      const position = new window.kakao.maps.LatLng(store.latitude, store.longitude);
      bounds.extend(position);

      // 프리미엄 마커 이미지 (별 모양 혹은 브랜드 컬러 아이콘)
      const markerImage = new window.kakao.maps.MarkerImage(
        'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
        new window.kakao.maps.Size(28, 40),
        { offset: new window.kakao.maps.Point(14, 40) }
      );

      const marker = new window.kakao.maps.Marker({
        position: position,
        map: map,
        title: store.name,
        image: markerImage,
        zIndex: 3
      });

      // [고도화된 커스텀 인포윈도우 HTML]
      const iwContent = `
        <div style="padding:16px; min-width:240px; border-radius:24px; background:white; position:relative; bottom:12px; font-family:'Pretendard', sans-serif; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
            <div style="font-weight:900; font-size:16px; color:#0f172a; max-width:160px; line-height:1.2;">${store.name}</div>
            <div style="background:#fff7ed; padding:4px 8px; border-radius:8px; border:1px solid #ffedd5; display:flex; align-items:center; gap:3px;">
              <span style="color:#f59e0b; font-size:12px;">★</span>
              <span style="font-weight:900; font-size:12px; color:#92400e;">${store.rating || '5.0'}</span>
            </div>
          </div>
          <div style="font-size:12px; color:#64748b; margin-bottom:12px; line-height:1.4;">${store.address || '주소 정보 없음'}</div>
          <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid #f1f5f9; pt:12px; margin-top:12px; padding-top:10px;">
            <div style="font-size:11px; font-weight:700; color:#3b82f6; background:#eff6ff; padding:2px 8px; border-radius:6px;">${bizLabel(store.business_type)}</div>
            <div style="font-size:11px; font-weight:800; color:#f97316;">대기 ${store.waiting_count || 0}팀</div>
          </div>
        </div>
      `;

      const infowindow = new window.kakao.maps.InfoWindow({
        content: iwContent,
        removable: true,
        zIndex: 10
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        markersRef.current.forEach(m => {
          if (m.infowindow) m.infowindow.close();
        });
        infowindow.open(map, marker);
        if (onStoreSelect) onStoreSelect(store);

        // 매장 클릭 시 부드럽게 중심점 이동
        map.panTo(position);
      });

      marker.infowindow = infowindow;
      markersRef.current.push(marker);
    });

    if (stores.length > 0 && !selectedStore) {
      if (!bounds.isEmpty()) {
        map.setBounds(bounds);
      }
    }
  }, [stores, onStoreSelect, selectedStore]);

  useEffect(() => {
    if (window.kakao && window.kakao.maps) {
      initializeMap();
      return;
    }

    const apiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY || '';
    if (!apiKey) {
      setError('카카오맵 API 키가 설정되지 않았습니다. .env 파일에 VITE_KAKAO_MAP_API_KEY를 추가해주세요.');
      return;
    }

    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,clusterer`;
    script.async = true;
    script.onload = () => {
      if (window.kakao) initializeMap();
    };
    script.onerror = () => setError('카카오맵 SDK를 불러오지 못했습니다. 네트워크 상태를 확인해주세요.');
    document.head.appendChild(script);

    return () => {
      markersRef.current.forEach(marker => marker.setMap(null));
    };
  }, [initializeMap]);

  useEffect(() => {
    if (isMapLoaded && stores.length > 0) {
      updateMarkers();
    }
  }, [stores, isMapLoaded, updateMarkers]);

  useEffect(() => {
    if (selectedStore && mapInstanceRef.current && selectedStore.latitude && selectedStore.longitude) {
      const position = new window.kakao.maps.LatLng(selectedStore.latitude, selectedStore.longitude);
      mapInstanceRef.current.panTo(position);
      mapInstanceRef.current.setLevel(3);

      // 선택된 매장의 인포윈도우 열기
      const targetMarker = markersRef.current.find(m => m.getTitle() === selectedStore.name);
      if (targetMarker) {
        markersRef.current.forEach(m => {
          if (m.infowindow) m.infowindow.close();
        });
        targetMarker.infowindow.open(mapInstanceRef.current, targetMarker);
      }
    }
  }, [selectedStore]);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setLevel(mapInstanceRef.current.getLevel() - 1);
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setLevel(mapInstanceRef.current.getLevel() + 1);
    }
  };

  const handleMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locPosition = new window.kakao.maps.LatLng(position.coords.latitude, position.coords.longitude);
          mapInstanceRef.current.panTo(locPosition);
          mapInstanceRef.current.setLevel(4);
        },
        () => { alert('위치 정보를 가져올 수 없습니다.'); }
      );
    } else {
      alert('위치 서비스를 지원하지 않는 브라우저입니다.');
    }
  };

  if (error) {
    return (
      <div className="h-full bg-slate-100 rounded-[2.5rem] flex items-center justify-center p-8 border-2 border-dashed border-slate-200">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-6">
            <MapPin className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-900 font-black mb-2">지도를 불러올 수 없습니다</p>
          <p className="text-slate-400 text-sm font-medium mb-6 leading-relaxed">{error}</p>
          <div className="p-4 bg-white/80 rounded-2xl text-left border border-white">
            <h4 className="text-[10px] font-black text-slate-800 mb-2 tracking-widest uppercase">Checklist</h4>
            <ul className="text-[10px] text-slate-400 space-y-1.5 font-bold list-disc pl-4">
              <li>카카오 개발자 콘솔 JavaScript 키 확인</li>
              <li>플랫폼 도메인(localhost:5173) 등록 여부</li>
              <li>네트워크 상태 및 API 호출 가능 여부</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full group">
      <div ref={mapRef} className="w-full h-full" />

      {/* 커스텀 플로팅 컨트롤 */}
      <div className="absolute top-6 right-6 flex flex-col gap-3 z-10">
        <button
          onClick={handleMyLocation}
          className="w-12 h-12 bg-white/90 backdrop-blur rounded-[1.2rem] shadow-heavy flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all active:scale-90"
          title="내 위치"
        >
          <Navigation className="w-5 h-5" />
        </button>
        <div className="flex flex-col bg-white/90 backdrop-blur rounded-[1.2rem] shadow-heavy overflow-hidden border border-white/50">
          <button
            onClick={handleZoomIn}
            className="w-12 h-12 flex items-center justify-center hover:bg-slate-50 border-b border-slate-100 transition-colors"
          >
            <ZoomIn className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-12 h-12 flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            <ZoomOut className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default KakaoMap;
