// 테이블 주문 시 매장 반경(500m) 확인용 위치. 거부·실패·시간 초과면 null을 돌려주고 주문은 그대로 진행한다.
export const getOrderPosition = (timeoutMs = 3000) =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        clearTimeout(timer);
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          location_accuracy: Math.round(coords.accuracy || 0),
        });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 }
    );
  });
