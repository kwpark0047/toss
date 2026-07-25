class CustomerController {
  constructor({ phoneJoin, getCustomerStats, getCustomerHistory, issueCoupon, customerRepository }) {
    this.phoneJoin = phoneJoin;
    this.getCustomerStats = getCustomerStats;
    this.getCustomerHistory = getCustomerHistory;
    this.issueCoupon = issueCoupon;
    this.customerRepository = customerRepository;
  }

  async phoneJoinHandler(req, res) {
    const { phone, store_id } = req.body;
    if (!phone || !store_id) {
      return res.status(400).json({ success: false, message: '휴대폰 번호와 매장 ID는 필수입니다.' });
    }
    const result = await this.phoneJoin.execute(req.body);
    if (result.duplicate) {
      return res.json({ success: false, message: result.message, already_joined: true });
    }
    res.json({ success: true, ...result });
  }

  async getStats(req, res) {
    const data = await this.getCustomerStats.execute(req.params.storeId);
    res.json({ success: true, data });
  }

  async getHistory(req, res) {
    const data = await this.getCustomerHistory.execute(req.params.storeId, req.params.customerId);
    if (!data) return res.status(404).json({ success: false, error: '고객 정보 없음' });
    res.json({ success: true, data });
  }

  async getCoupons(req, res) {
    const coupons = await this.customerRepository.getCoupons(parseInt(req.params.storeId));
    res.json({ success: true, data: coupons });
  }

  async issueCouponHandler(req, res) {
    const { coupon_id } = req.body;
    if (!coupon_id) return res.status(400).json({ success: false, error: '쿠폰 ID가 필요합니다.' });
    const result = await this.issueCoupon.execute(req.params.storeId, req.params.customerId, coupon_id);
    if (result.error) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, data: result.issued, message: `${result.couponName} 쿠폰이 발급되었습니다.` });
  }

  async getDetail(req, res) {
    const customer = await this.customerRepository.findById(parseInt(req.params.customerId));
    if (!customer) return res.status(404).json({ success: false, error: '고객 정보를 찾을 수 없습니다.' });

    if (req.user.role !== 'super_admin') {
      const { getStoreRole } = require('../../middleware/storeAuth');
      const role = await getStoreRole(req.user.id, customer.store_id);
      if (!role) return res.status(403).json({ success: false, error: '해당 매장의 고객 정보에 접근할 권한이 없습니다.' });
    }
    res.json({ success: true, data: customer });
  }

  async getCustomers(req, res) {
    const { sortBy, order, limit, search } = req.query;
    const customers = await this.customerRepository.findByStoreId(req.params.storeId, {
      sortBy, order, limit: limit ? parseInt(limit) : 50, search,
    });
    res.json({ success: true, data: customers });
  }

  async updateLocation(req, res) {
    const { phone, latitude, longitude } = req.body;
    const nearbyStore = await this.customerRepository.getNearbyStores(latitude, longitude);

    if (nearbyStore && nearbyStore.coupons.length > 0) {
      const user = await this.customerRepository.findByPhoneGlobal(phone);
      if (user) {
        const fcmToken = await this.customerRepository.getFcmToken(user.user_id);
        if (fcmToken) {
          const notificationService = require('../../utils/notifications');
          await notificationService.sendPushNotification(fcmToken, {
            title: `지금 ${nearbyStore.name}이 근처에 있어요!`,
            body: `'${nearbyStore.coupons[0].name}' 쿠폰이 준비되어 있습니다. 지금 방문해 보세요!`,
            data: { storeId: nearbyStore.id.toString(), type: 'GEO_MARKETING' },
          });
          return res.json({ success: true, message: '근처 매장 혜택 알림을 발송했습니다.', storeName: nearbyStore.name });
        }
      }
    }
    res.json({ success: true, message: '업데이트 완료 (근처 혜택 없음)' });
  }

  async registerFcmToken(req, res) {
    const { phone, store_id, fcm_token } = req.body;
    if (!phone || !store_id || !fcm_token) {
      return res.status(400).json({ success: false, message: 'phone, store_id, fcm_token은 필수입니다.' });
    }
    await this.customerRepository.registerFcmToken(parseInt(store_id), phone, fcm_token);
    res.json({ success: true, message: '알림 토큰이 등록되었습니다.' });
  }
}

module.exports = CustomerController;
