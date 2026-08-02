const logger = require('../utils/logger');

class FoodTruckLocationService {
  constructor(io) {
    this.io = io;
    this.activeTrucks = new Map(); // truckId -> { latitude, longitude, updatedAt, storeId }
  }

  /**
   * 푸드트럭 실시간 GPS 위치 업데이트 및 브로드캐스트
   */
  updateLocation(truckId, data) {
    const { latitude, longitude, storeId, status } = data;
    if (!latitude || !longitude) return;

    const locationData = {
      truckId,
      storeId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      status: status || 'OPEN',
      updatedAt: new Date().toISOString(),
    };

    this.activeTrucks.set(truckId, locationData);

    if (this.io) {
      // 해당 매장 또는 전체 고객에게 푸드트럭 위치 브로드캐스트
      if (storeId) {
        this.io.to(`store-${storeId}`).emit('food-truck-location', locationData);
      }
      this.io.emit('global-food-truck-location', locationData);
    }

    logger.debug({ truckId, latitude, longitude }, 'Food truck location updated');
    return locationData;
  }

  getActiveTruck(truckId) {
    return this.activeTrucks.get(truckId) || null;
  }

  getAllActiveTrucks() {
    return Array.from(this.activeTrucks.values());
  }
}

let instance = null;
function initFoodTruckLocationService(io) {
  if (!instance) {
    instance = new FoodTruckLocationService(io);
  }
  return instance;
}

module.exports = { FoodTruckLocationService, initFoodTruckLocationService };
