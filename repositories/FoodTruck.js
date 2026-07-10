const prisma = require('../config/prisma');

/**
 * 푸드트럭 레포지토리 (Prisma 기반)
 * 이동식 푸드트럭의 세션 상태, GPS 위치 추적 및 긴급 품절 처리를 관리합니다.
 */
const FoodTruck = {
    /**
     * 특정 매장(스토어)의 푸드트럭 메타데이터 조회
     */
    findByStoreId: async (storeId) => {
        try {
            if (!storeId) return null;
            return await prisma.food_trucks.findUnique({
                where: { store_id: parseInt(storeId) }
            });
        } catch (error) {
            console.error(`[Prisma Error] FoodTruck.findByStoreId failed for store_id: ${storeId}`, error);
            throw error;
        }
    },

    /**
     * 푸드트럭 데이터 Upsert (세션 활성화/수정 시 자동 생성 대비)
     */
    upsert: async (storeId, data) => {
        try {
            const sid = parseInt(storeId);
            return await prisma.food_trucks.upsert({
                where: { store_id: sid },
                update: data,
                create: {
                    store_id: sid,
                    ...data
                }
            });
        } catch (error) {
            console.error(`[Prisma Error] FoodTruck.upsert failed for store_id: ${storeId}`, error);
            throw error;
        }
    },

    /**
     * 푸드트럭 실시간 GPS 업데이트 및 주소 갱신
     */
    updateGps: async (storeId, latitude, longitude, geocodedAddress) => {
        try {
            return await prisma.food_trucks.upsert({
                where: { store_id: parseInt(storeId) },
                update: {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    geocoded_address: geocodedAddress,
                    last_gps_updated_at: new Date()
                },
                create: {
                    store_id: parseInt(storeId),
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    geocoded_address: geocodedAddress,
                    last_gps_updated_at: new Date()
                }
            });
        } catch (error) {
            console.error(`[Prisma Error] FoodTruck.updateGps failed for store_id: ${storeId}`, error);
            throw error;
        }
    },

    /**
     * 영업 세션 활성화 및 비활성화 토글
     */
    toggleSession: async (storeId, isActiveSession) => {
        try {
            return await prisma.food_trucks.upsert({
                where: { store_id: parseInt(storeId) },
                update: {
                    is_active_session: !!isActiveSession
                },
                create: {
                    store_id: parseInt(storeId),
                    is_active_session: !!isActiveSession
                }
            });
        } catch (error) {
            console.error(`[Prisma Error] FoodTruck.toggleSession failed for store_id: ${storeId}`, error);
            throw error;
        }
    },

    /**
     * 재료 소진 긴급 비상 조치 (Emergency Sold Out) 토글
     */
    toggleEmergencySoldOut: async (storeId, isEmergencySoldOut) => {
        try {
            return await prisma.food_trucks.upsert({
                where: { store_id: parseInt(storeId) },
                update: {
                    is_sold_out_emergency: !!isEmergencySoldOut
                },
                create: {
                    store_id: parseInt(storeId),
                    is_sold_out_emergency: !!isEmergencySoldOut
                }
            });
        } catch (error) {
            console.error(`[Prisma Error] FoodTruck.toggleEmergencySoldOut failed for store_id: ${storeId}`, error);
            throw error;
        }
    },

    /**
     * 현재 활성화된(영업 중인) 모든 푸드트럭 목록 조회
     */
    findActive: async () => {
        try {
            return await prisma.food_trucks.findMany({
                where: { is_active_session: true },
                include: {
                    stores: true
                }
            });
        } catch (error) {
            console.error('[Prisma Error] FoodTruck.findActive failed', error);
            throw error;
        }
    }
};

module.exports = FoodTruck;
