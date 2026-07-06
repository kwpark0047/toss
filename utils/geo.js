/**
 * 지리 좌표 유틸.
 * haversineKm — 두 위경도 좌표 사이의 대원거리(km)를 계산.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // 지구 반지름(km)
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { haversineKm };
