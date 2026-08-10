const catchAsync = require('../utils/catchAsync');
const aiService = require('../services/aiService');
const Product = require('../repositories/Product');
const Order = require('../repositories/Order');
const WaitingService = require('../services/WaitingService');
const customerPreferenceService = require('../services/CustomerPreferenceService');
const { success, created, error, validationError } = require('../utils/apiResponse');

const waitingService = new WaitingService();

const waitingController = {
  // [GET] 특정 매장의 현재 대기 현황 조회
  getStoreStatus: catchAsync(async (req, res) => {
    const count = await waitingService.getStoreStatus(req.params.storeId);
    return success(res, { waiting_teams: count }, '대기 현황 조회 성공');
  }),

  // [GET] 특정 매장의 대기 리스트 조회 (관리자)
  getStoreWaitingList: catchAsync(async (req, res) => {
    const data = await waitingService.getStoreWaitingList(req.params.storeId);
    return success(res, data, '대기 리스트 조회 성공');
  }),

  // [POST] 대기 등록 (고객)
  register: catchAsync(async (req, res) => {
    const data = await waitingService.register(req.body);
    return created(res, data, '대기 등록 완료');
  }),

  // [PATCH] 대기 상태 변경 (관리자: 호출/입장/취소, 고객: 취소)
  updateStatus: catchAsync(async (req, res) => {
    const data = await waitingService.updateStatus(req.params.id, req.body.status);
    // 대기 상태 변경 시점에 실시간으로 스태프 대시보드와 고객 단말에 전파.
    // (REST 경유 시 소켓 방송이 누락되어 목록이 폴링에만 의존하던 문제 해결)
    const io = req.app?.get?.('io');
    const storeId = data?.store_id;
    const phone = data?.customer_phone;
    if (io && storeId) {
      io.to(`store - waiting - ${storeId}`).emit('waiting-list-changed', { storeId });
      io.to(`store - waiting - ${storeId}`).emit('refresh-ahead-count');
    }
    if (io && phone) {
      io.to(`customer - waiting - ${phone}`).emit('waiting-status-changed', {
        status: data.status,
        entry: data,
        message:
          data.status === 'called'
            ? '입장해 주세요! 점원이 기다리고 있습니다.'
            : '대기 상태가 업데이트되었습니다.',
      });
    }
    return success(res, data, '대기 상태 변경 완료');
  }),

  // [GET] 내 대기 상태 조회 (휴대폰 번호 기준)
  getMyWaiting: catchAsync(async (req, res) => {
    const data = await waitingService.getMyWaiting(req.params.phone);
    return success(res, data, '내 대기 상태 조회 성공');
  }),

  // [GET] AI 기반 대기 중 메뉴 추천 (개인화)
  // GET /api/waiting/store/:storeId/ai-suggestions?weather=&mood=&phone=&toss_user_key=
  getAISuggestions: catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return error(res, '유효하지 않은 매장 ID입니다.', 400);

    const { weather, mood, phone, toss_user_key } = req.query;

    const menuList = await Product.findActiveAndInStock(storeId);
    if (menuList.length === 0) {
      return success(res, { suggestions: [], source: 'ai' }, '추천 메뉴 없음');
    }

    // 개인화 추천 서비스 사용 (전화번호가 있는 경우)
    if (phone) {
      const suggestions = await customerPreferenceService.getPersonalizedRecommendations(
        storeId,
        phone,
        menuList,
        {
          weather: weather || '맑음',
          mood: mood || '보통',
          time: new Date().toLocaleTimeString('ko-KR'),
        }
      );

      return success(
        res,
        {
          suggestions: suggestions.map((s) => ({
            id: s.id,
            name: s.name,
            price: s.price,
            reason: s.reason,
            is_favorite: s.is_favorite,
          })),
          source: 'personalized_ai',
        },
        '개인화 추천 완료'
      );
    }

    // 전화번호 없으면 기존 방식 (비개인화)
    let pastOrders = [];
    if (toss_user_key) {
      const history = await Order.findByCustomer(null, toss_user_key);
      pastOrders = history
        .flatMap((order) => order.items.map((item) => item.product_name))
        .slice(0, 10);
    }

    const hour = new Date().getHours();
    const time = new Date().toLocaleTimeString('ko-KR');
    const timePeriod =
      hour >= 5 && hour < 10
        ? '아침 (조식)'
        : hour >= 10 && hour < 15
          ? '점심 (중식)'
          : hour >= 15 && hour < 17
            ? '오후 간식'
            : hour >= 17 && hour < 22
              ? '저녁 (석식)'
              : '야식';

    const trendingProductIds = await Order.findTrendingProducts(storeId);
    const trendingNames =
      trendingProductIds.length > 0
        ? await Product.findByIds(trendingProductIds, { name: true }).then((rows) =>
            rows.map((r) => r.name)
          )
        : [];

    const recommendations = await aiService.recommendMenus(
      {
        preferences: undefined,
        time,
        weather: weather || '맑음',
        mood: mood || '보통',
        pastOrders,
        trendingItems: trendingNames,
        timePeriod,
      },
      menuList
    );

    const suggestions = recommendations
      .slice(0, 3)
      .map((rec) => {
        const menu = menuList.find((m) => m.id === rec.id);
        if (!menu) return null;
        return { id: menu.id, name: menu.name, price: menu.price, reason: rec.reason };
      })
      .filter(Boolean);

    return success(res, { suggestions, source: 'ai' }, 'AI 추천 완료');
  }),

  // [PATCH] 알림톡 재발송 (상태 변경 없이 알림만 재전송)
  resendNotification: catchAsync(async (req, res) => {
    const data = await waitingService.resendNotification(req.params.id);
    return success(res, data, '알림톡 재발송 완료');
  }),

  // [POST] 즐겨찾기 메뉴 토글 (고객)
  toggleFavorite: catchAsync(async (req, res) => {
    const { store_id, customer_phone, menu_id } = req.body;
    if (!store_id || !customer_phone || !menu_id) {
      return validationError(
        res,
        { store_id, customer_phone, menu_id },
        'store_id, customer_phone, menu_id 필수'
      );
    }
    const data = await customerPreferenceService.toggleFavorite(store_id, customer_phone, menu_id);
    return success(res, data, '즐겨찾기 토글 완료');
  }),
};

module.exports = waitingController;
