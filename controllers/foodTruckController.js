const FoodTruckService = require('../services/FoodTruckService');
const FoodTruckRepository = require('../repositories/FoodTruck');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../utils/errorHandler');

/**
 * 푸드트럭 컨트롤러
 * 모바일 GPS 수신, 영업 세션 상태 기기 제어, 비상 재료소진 처리, 실시간 맵 목록 조회 핸들러를 제공합니다.
 */
const foodTruckController = {
    /**
     * [POST] 푸드트럭 실시간 위치 (GPS) 갱신
     */
    updateLocation: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined) {
            throw new AppError('위도(latitude)와 경도(longitude) 값은 필수입니다.', 400);
        }

        const truck = await FoodTruckService.trackLocation(storeId, latitude, longitude);
        res.success(truck, '푸드트럭의 현재 위치가 성공적으로 업데이트되었습니다.');
    }),

    /**
     * [POST] 푸드트럭 현장 영업 세션 토글 (개설/종료)
     */
    toggleSession: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const { is_active_session } = req.body;

        if (is_active_session === undefined) {
            throw new AppError('is_active_session 필드가 누락되었습니다.', 400);
        }

        const truck = await FoodTruckService.toggleActiveSession(storeId, is_active_session);
        res.success(truck, is_active_session ? '영업 세션이 시작되었습니다.' : '영업 세션이 마감되었습니다.');
    }),

    /**
     * [POST] 긴급 재료소진 비상 마감 스위치 제어
     */
    toggleEmergencySoldOut: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const { is_sold_out_emergency } = req.body;

        if (is_sold_out_emergency === undefined) {
            throw new AppError('is_sold_out_emergency 필드가 누락되었습니다.', 400);
        }

        const truck = await FoodTruckService.toggleEmergencySoldOut(storeId, is_sold_out_emergency);
        res.success(
            truck, 
            is_sold_out_emergency 
                ? '전메뉴 일시품절 처리 및 비상 마감이 적용되었습니다.' 
                : '비상 마감이 해제되고 영업 상태가 정상 복구되었습니다.'
        );
    }),

    /**
     * [GET] 현재 운영 중인 모든 활성 푸드트럭 목록 조회
     */
    getActiveFoodTrucks: catchAsync(async (req, res) => {
        const trucks = await FoodTruckRepository.findActive();
        res.success(trucks, '현재 영업 중인 푸드트럭 목록을 성공적으로 불러왔습니다.');
    }),

    /**
     * [GET] 특정 매장의 푸드트럭 세부 상태 조회
     */
    getFoodTruckStatus: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const truck = await FoodTruckRepository.findByStoreId(storeId);

        if (!truck) {
            // 매장 소유지만 푸드트럭 설정이 아직 생성되지 않은 초기 상태 폴백 반환
            return res.success({
                store_id: parseInt(storeId),
                is_active_session: false,
                latitude: null,
                longitude: null,
                geocoded_address: null,
                is_sold_out_emergency: false
            }, '초기 상태의 푸드트럭 프로필입니다.');
        }

        res.success(truck, '푸드트럭 상태 정보 조회가 완료되었습니다.');
    }),

    ingredientSoldOut: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const { ingredientName } = req.body;

        if (!ingredientName) {
            throw new AppError('소진된 재료 명칭은 필수입니다.', 400);
        }

        const result = await FoodTruckService.processIngredientSoldOut(storeId, ingredientName);
        res.success(result, `재료 소진으로 관련 상품 ${result.updatedCount}개가 일시 품절 처리되었습니다.`);
    }),

    /**
     * [POST] 위치 기반 타임세일 전송
     */
    triggerFlashSale: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const { discountPercent, message, radiusMeters } = req.body;

        if (discountPercent === undefined || !message) {
            throw new AppError('할인율(discountPercent)과 메세지(message)는 필수입니다.', 400);
        }

        const targetedCustomers = await FoodTruckService.triggerFlashSale(
            storeId, 
            discountPercent, 
            message, 
            radiusMeters
        );

        res.success(
            targetedCustomers, 
            `총 ${targetedCustomers.length}명의 반경 내 단골 고객에게 타임세일 알림 전송이 완료되었습니다.`
        );
    }),

    /**
     * [POST] 오프라인 거래내역 배치 동기화
     */
    processOfflineSync: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const { offlineTransactions } = req.body;

        if (!offlineTransactions || !Array.isArray(offlineTransactions)) {
            throw new AppError('올바르지 않은 offlineTransactions 목록입니다.', 400);
        }

        const result = await FoodTruckService.processOfflineSync(storeId, offlineTransactions);
        res.success(result, `성공적으로 ${result.synchronizedCount}건의 오프라인 결제 데이터를 안전하게 동기화하였습니다.`);
    }),

    /**
     * [GET] 푸드트럭 인공지능 분석 및 영업 통계 리포트 조회
     */
    getAnalytics: catchAsync(async (req, res) => {
        const { storeId } = req.params;
        const analytics = await FoodTruckService.getPeakTimeAndLocationAnalytics(storeId);
        res.success(analytics, '푸드트럭의 지능형 피크타임 및 거점별 매출 분석 보고서가 성공적으로 로드되었습니다.');
    })
};

module.exports = foodTruckController;
