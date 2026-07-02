import axios from 'axios';

const getApiUrl = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }
  return 'https://wemarket.onrender.com/api';
};

const API_URL = getApiUrl();

/**
 * Render 콜드스타트 웨이크업: 서버가 슬립 상태일 때 깨울 때까지 폴링.
 * 최대 60초, 3초 간격으로 /api/health를 호출하여 서버가 준비되면 resolve.
 */
let _wakeupPromise = null;
export const wakeupServer = () => {
  if (_wakeupPromise) return _wakeupPromise;
  const baseUrl = API_URL.replace('/api', '');
  const MAX_WAIT_MS = 60_000;
  const POLL_MS = 3_000;
  const startedAt = Date.now();

  _wakeupPromise = (async () => {
    while (Date.now() - startedAt < MAX_WAIT_MS) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 5_000);
        await fetch(`${baseUrl}/api/health`, { method: 'GET', mode: 'cors', signal: ctrl.signal });
        clearTimeout(tid);
        return; // 서버 준비 완료
      } catch {
        await new Promise(r => setTimeout(r, POLL_MS));
      }
    }
    throw new Error('서버 웨이크업 시간 초과 (60s)');
  })().finally(() => { _wakeupPromise = null; });

  return _wakeupPromise;
};

// 프로덕션에서 모듈 로드 즉시 서버 웨이크업 시작 (로그인 전부터 서버를 예열)
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  wakeupServer().catch(() => {});
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Bearer 토큰을 사용하므로 withCredentials는 일단 제거 (CORS 이슈 방지)
});

// 요청 인터셉터 - 토큰 추가
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터 - 데이터 구조 표준화 및 에러 핸들링
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // ── Render 콜드스타트 자동 재시도 ──
    // 네트워크 에러 발생 시 서버가 준비될 때까지(최대 60초) 폴링 후 1회 재시도
    const isNetworkError = !error.response;
    const isCorsOrNetworkError = error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');
    if ((isNetworkError || isCorsOrNetworkError) && !originalRequest._coldRetry) {
      originalRequest._coldRetry = true;
      try {
        await wakeupServer(); // 서버 준비 완료까지 블로킹 (최대 60초)
        return api(originalRequest);
      } catch {
        // 웨이크업 타임아웃 → 원래 에러 전파
      }
    }

    // 401 에러 처리 - 토큰 갱신
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
          const { token, refreshToken: newRefreshToken } = response.data.data || response.data;
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', newRefreshToken);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (err) {
        console.error('토큰 갱신 실패:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        // 공개 페이지(/menu, /qr)에서는 로그아웃 리다이렉트 금지
        // — 고객이 메뉴판 접근 시 관리자 세션 만료로 로그아웃되는 문제 방지
        const path = window.location.pathname;
        const isPublicPage = path.startsWith('/menu') || path.startsWith('/qr') || path === '/';
        if (!isPublicPage && !path.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// =========================================================================
// API 모듈 정의
// 각 도메인별(인증, 매장, 상품 등)로 API 함수를 그룹화하여 정의합니다.
// =========================================================================

// === [1. 인증/계정 관련] ===
export const authAPI = {
  // OTP 발송 (핸드폰 번호 인증)
  sendOtp: (phone) => api.post('/auth/send-otp', { phone }),
  // OTP 검증
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  // 핸드폰 번호 기반 가입 (OTP 인증 완료 후)
  register: (data) => api.post('/auth/register', data),
  // identifier = 핸드폰 번호 또는 이메일
  login: (identifier, password) => api.post('/auth/login', { identifier, password }),
  me: () => api.get('/auth/me'),
  logout: () => Promise.resolve(),
  // 프로필 업데이트 (name, email, address)
  updateProfile: (data) => api.put('/auth/profile', data),
  // 비밀번호 변경
  changePassword: (current_password, new_password) => api.put('/auth/password', { current_password, new_password }),
};

// === [2. 고객 관리] ===
export const customersAPI = {
  getAll: (search) => api.get('/customers' + (search ? '?search=' + search : '')),
  getById: (id) => api.get('/customers/' + id),
  getStats: () => api.get('/customers/stats'),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put('/customers/' + id, data),
  delete: (id) => api.delete('/customers/' + id),
  // 주문 후 핸드폰 번호 통합 등록 (인증 불필요)
  phoneJoin: (data) => api.post('/customers/phone-join', data),
};

// === [3. 매장 관리] ===
export const storesAPI = {
  getAll: () => api.get('/stores'), // 전체 매장 조회 (검색용)
  getMy: () => api.get('/stores/my'), // 내 매장 목록
  getById: (id) => api.get('/stores/' + id), // 매장 상세
  create: (data) => api.post('/stores', data), // 매장 생성
  update: (id, data) => api.put('/stores/' + id, data), // 매장 정보 수정
  delete: (id) => api.delete('/stores/' + id), // 매장 삭제 (비활성화)
};

export const storeAccountAPI = {
  get: (storeId) => api.get('/stores/' + storeId + '/account'), // 매장 계좌 정보 조회
};


// === [4. 상품 및 카테고리] ===
export const categoriesAPI = {
  getAll: () => api.get('/categories/store/1'),
  getByStore: (storeId) => api.get('/categories/store/' + storeId),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put('/categories/' + id, data),
  delete: (id) => api.delete('/categories/' + id),
  updateSort: (orders) => api.put('/categories/sort', { orders }),
};

export const productsAPI = {
  getAll: () => api.get('/products/store/1'), // [데모용] 1번 매장 상품 조회
  // 매장별 상품 목록 조회 (카테고리 필터 가능)
  getByStore: (storeId, categoryId) => {
    let url = '/products/store/' + storeId;
    if (categoryId) url += '?category_id=' + categoryId;
    return api.get(url);
  },
  getById: (id) => api.get('/products/' + id),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put('/products/' + id, data),
  delete: (id) => api.delete('/products/' + id),
  bulkCreate: (data) => api.post('/products/bulk', data),
  importFromStore: (targetId, sourceId) => api.post('/products/import', { target_store_id: targetId, source_store_id: sourceId }),
};

// === [5. 테이블 및 주문] ===
export const tablesAPI = {
  getByStore: (storeId) => api.get('/tables/store/' + storeId),
  getByQrCode: (qrCode) => api.get('/tables/qr/' + qrCode),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put('/tables/' + id, data),
  delete: (id) => api.delete('/tables/' + id),
  regenerateQr: (id) => api.post('/tables/' + id + '/regenerate-qr'),
};

export const ordersAPI = {
  // 매장별 주문 목록 (상태, 날짜 필터)
  getByStore: (storeId, status, date) => {
    let url = '/orders/store/' + storeId;
    const params = [];
    if (status) params.push('status=' + status);
    if (date) params.push('date=' + date);
    if (params.length > 0) url += '?' + params.join('&');
    return api.get(url);
  },
  // 주문 요약 통계
  getStats: (storeId, startDate, endDate) => {
    let url = '/orders/store/' + storeId + '/stats';
    const params = [];
    if (startDate) params.push('start_date=' + startDate);
    if (endDate) params.push('end_date=' + endDate);
    if (params.length > 0) url += '?' + params.join('&');
    return api.get(url);
  },
  create: (data) => api.post('/orders', data), // 주문 생성
  updateStatus: (id, status, staffId = null) => api.put('/orders/' + id + '/status', { status, staff_id: staffId }), // 주문 상태 및 처리자 업데이트
  delete: (id) => api.delete('/orders/' + id),
  getById: (id) => api.get('/orders/' + id), // 주문 상세

  // 상세 주문 분석 (그래프용)
  getDetailedStats: (storeId, startDate, endDate) => {
    let url = '/orders/store/' + storeId + '/detailed-stats';
    const params = [];
    if (startDate) params.push('start_date=' + startDate);
    if (endDate) params.push('end_date=' + endDate);
    if (params.length > 0) url += '?' + params.join('&');
    return api.get(url);
  },
};


// === [6. 결제 및 정산] ===
export const paymentsAPI = {
  create: (data) => api.post('/payments', data), // 결제 생성 요청
  getById: (id) => api.get('/payments/' + id),
  confirm: (id, data) => api.post('/payments/' + id + '/confirm', data), // 결제 승인
  cancel: (id, data) => api.post('/payments/' + id + '/cancel', data), // 결제 키/ID 기반 취소
  cancelByOrder: (orderId, data) => api.post('/payments/order/' + orderId + '/cancel', data), // 주문 번호로 결제 취소
  uploadProof: (id, formData) => api.post(`/payments/${id}/proof`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getBrandPayConfig: () => api.get('/payments/brandpay/config'), // 브랜드페이 설정 조회
  splitRequest: (data) => api.post('/payments/split/request', data), // 분할 결제 요청 설정
  splitPay: (data) => api.post('/payments/split/pay', data),       // 분할 결제 내 몫 결제
  splitStatus: (orderId) => api.get('/payments/split/' + orderId + '/status'), // 분할 결제 현황 조회
};

// === [7. 직원 관리] ===
export const staffAPI = {
  getByStore: (storeId) => api.get('/staff/store/' + storeId),
  getById: (id) => api.get('/staff/' + id),
  getMyRole: (storeId) => api.get(`/staff/store/${storeId}/role`),
  create: (data) => api.post('/staff', data),
  update: (id, data) => api.put('/staff/' + id, data),
  updateRole: (id, role) => api.put('/staff/' + id, { role }),
  delete: (id) => api.delete('/staff/' + id),
  // 근태
  getAttendance: (storeId, params) => api.get(`/staff/store/${storeId}/attendance`, { params }),
  clockIn: (id, note) => api.post(`/staff/${id}/clock-in`, { note }),
  clockOut: (id) => api.post(`/staff/${id}/clock-out`),
  // 1인 매장 셀프 등록
  selfRegister: (storeId) => api.post('/staff/self-register', { storeId }),
};

// === [8. 포인트 및 분석] ===
export const pointsAPI = {
  getBalance: (params) => api.get('/points/balance', { params }), // 포인트 잔액 조회
  getHistory: (params) => api.get('/points/history', { params }), // 적립/사용 내역

  // 사용 가능 포인트 계산
  calculateUsable: (amount, storeId, params) =>
    api.get(`/points/calculate-usable?amount=${amount}&store_id=${storeId}`, { params }),

  // 적립 예정 포인트 계산
  calculateEarn: (amount, storeId) =>
    api.get(`/points/calculate-earn?amount=${amount}&store_id=${storeId}`),
};

export const analyticsAPI = {
  // 매출 분석 (기간별)
  getSales: (storeId, period, startDate, endDate) =>
    api.get(`/analytics/store/${storeId}/sales?period=${period}&start_date=${startDate}&end_date=${endDate}`),

  // 비교 분석 (매출, 주문수 등)
  getComparison: (storeId, type) =>
    api.get(`/analytics/store/${storeId}/comparison?type=${type}`),

  // 인기 상품 분석
  getProducts: (storeId, startDate, endDate, limit = 10, sort = 'quantity') =>
    api.get(`/analytics/store/${storeId}/products?start_date=${startDate}&end_date=${endDate}&limit=${limit}&sort=${sort}`),

  // 직원 실적 분석
  getStaff: (storeId, startDate, endDate) =>
    api.get(`/analytics/store/${storeId}/staff?start_date=${startDate}&end_date=${endDate}`),

  // KDS 효율 분석
  getKds: (storeId, startDate, endDate) =>
    api.get(`/analytics/store/${storeId}/kds?start_date=${startDate}&end_date=${endDate}`),

  // 다점포 통합 분석
  getMultiStore: (params) => api.get('/analytics/multi-store', { params }),
};

// === [알림 센터 API] ===
export const notificationsAPI = {
  // 알림 목록 (unread=true, type=NEW_ORDER 등 필터 가능)
  getList: (storeId, params = {}) =>
    api.get('/notifications', { params: { store_id: storeId, ...params } }),

  // 읽지 않은 알림 수 + 타입별 요약
  getUnreadCount: (storeId) =>
    api.get('/notifications/unread-count', { params: { store_id: storeId } }),

  // 단일 읽음 처리
  markAsRead: (id) =>
    api.patch(`/notifications/${id}/read`),

  // 전체 읽음 처리
  markAllAsRead: (storeId) =>
    api.patch('/notifications/read-all', null, { params: { store_id: storeId } }),

  // 단일 삭제
  delete: (id) =>
    api.delete(`/notifications/${id}`),

  // 전체 삭제 (mode: 'read' | 'all')
  clear: (storeId, mode = 'read') =>
    api.delete('/notifications/clear', { params: { store_id: storeId, mode } }),

  // FCM 토큰 등록
  registerToken: (token) =>
    api.post('/notifications/register-token', { token }),
};

// === [내보내기 API] ===
export const exportAPI = {
  // 공통 다운로드 헬퍼
  _download: async (url, fileName) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${api.defaults.baseURL}${url}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('파일 생성에 실패했습니다.');
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  // Excel: 매출 통계 (일별/시간대/요일/결제수단 4개 시트)
  salesExcel: (storeId, startDate, endDate) =>
    exportAPI._download(
      `/export/store/${storeId}/excel/sales?start_date=${startDate}&end_date=${endDate}`,
      `매출통계_${storeId}_${startDate}_${endDate}.xlsx`
    ),

  // Excel: 주문 내역
  ordersExcel: (storeId, startDate, endDate) =>
    exportAPI._download(
      `/export/store/${storeId}/excel/orders?start_date=${startDate}&end_date=${endDate}`,
      `주문내역_${storeId}_${startDate}_${endDate}.xlsx`
    ),

  // Excel: 단골 고객 리스트
  customersExcel: (storeId) =>
    exportAPI._download(
      `/export/store/${storeId}/excel/customers`,
      `단골고객_${storeId}.xlsx`
    ),

  // Excel: 메뉴 판매 분석 (ABC 등급)
  menuExcel: (storeId, startDate, endDate) =>
    exportAPI._download(
      `/export/store/${storeId}/excel/menu?start_date=${startDate}&end_date=${endDate}`,
      `메뉴분석_${storeId}_${startDate}_${endDate}.xlsx`
    ),

  // PDF: 종합 보고서
  reportPdf: (storeId, startDate, endDate) =>
    exportAPI._download(
      `/export/store/${storeId}/pdf/report?start_date=${startDate}&end_date=${endDate}`,
      `종합보고서_${storeId}_${startDate}_${endDate}.pdf`
    ),
};

// === [9. 정산 및 영수증 설정] ===
export const adminAPI = {
  getSettlements: (storeId) => api.get(`/admin/stores/${storeId}/settlements`), // 정산 내역 조회
  generateSettlement: (storeId, data) => api.post(`/admin/stores/${storeId}/settlements/generate`, data), // 정산 생성
  getReceiptSettings: (storeId) => api.get(`/admin/stores/${storeId}/receipt-settings`), // 영수증 설정 조회
  updateReceiptSettings: (storeId, data) => api.put(`/admin/stores/${storeId}/receipt-settings`, data), // 영수증 설정 업데이트
};

// === [10. 플랜 업그레이드 신청] ===
export const planRequestsAPI = {
  // 플랜 업그레이드 신청 (store_admin)
  create: (data) => api.post('/plan-requests', data),
  // 매장별 신청 내역
  getByStore: (storeId) => api.get(`/plan-requests/store/${storeId}`),
  // 전체 신청 목록 (super_admin)
  getAll: (status = null) => api.get(`/plan-requests${status ? `?status=${status}` : ''}`),
  // 대기 중인 신청 수 (super_admin)
  getPendingCount: () => api.get('/plan-requests/pending-count'),
  // 승인 (super_admin)
  approve: (id, adminNote = '') => api.post(`/plan-requests/${id}/approve`, { admin_note: adminNote }),
  // 거절 (super_admin)
  reject: (id, adminNote = '') => api.post(`/plan-requests/${id}/reject`, { admin_note: adminNote }),
};

// === [10-2. 최고관리자 통합 Bulk SMS] ===
export const bulkSmsAPI = {
  getFilterOptions: () => api.get('/admin/bulk-sms/filter-options'),
  getFilteredCustomers: (params) => api.get('/admin/bulk-sms/customers', { params }),
  sendBulkSms: (data) => api.post('/admin/bulk-sms/send', data),
};

// === [11. 스태프 계정 신청] ===
export const staffRequestsAPI = {
  // 계정 신청 (store_admin)
  create: (data) => api.post('/staff-requests', data),
  // 매장별 신청 내역
  getByStore: (storeId) => api.get(`/staff-requests/store/${storeId}`),
  // 전체 신청 목록 (super_admin)
  getAll: (status = null) => api.get(`/staff-requests${status ? `?status=${status}` : ''}`),
  // 대기 중인 신청 수 (super_admin)
  getPendingCount: () => api.get('/staff-requests/pending-count'),
  // 승인 (super_admin)
  approve: (id, adminNote = '') => api.post(`/staff-requests/${id}/approve`, { admin_note: adminNote }),
  // 거절 (super_admin)
  reject: (id, adminNote = '') => api.post(`/staff-requests/${id}/reject`, { admin_note: adminNote }),
};

// === [12. 게시판 API (공통)] ===
export const boardAPI = {
  // 게시글 목록 조회 (페이지네이션, 검색, 태그 필터)
  getPosts: (type, params) => api.get(`/boards/${type}`, { params }),
  // 인기글 조회
  getTrending: (limit = 5) => api.get(`/boards/trending`, { params: { limit } }),
  // 게시글 상세 조회
  getPost: (id) => api.get(`/boards/posts/${id}`),
  // 게시글 작성
  createPost: (type, data) => api.post(`/boards/${type}`, data),
  // 게시글 수정
  updatePost: (id, data) => api.put(`/boards/posts/${id}`, data),
  // 게시글 삭제
  deletePost: (id) => api.delete(`/boards/posts/${id}`),
  // 고정글 토글
  togglePin: (id) => api.put(`/boards/posts/${id}/pin`),
  // 좋아요 토글
  toggleLike: (id) => api.post(`/boards/posts/${id}/like`),
  // 댓글 목록 조회
  getComments: (postId) => api.get(`/boards/posts/${postId}/comments`),
  // 댓글 작성
  createComment: (postId, data) => api.post(`/boards/posts/${postId}/comments`, data),
  // 댓글 삭제
  deleteComment: (id) => api.delete(`/boards/comments/${id}`),
};

// === [14. 실시간 채팅 API] ===
export const chatAPI = {
  accessRoom: (data) => api.post('/chat/rooms/access', data), // 채팅방 입장/생성
  getMessages: (roomId) => api.get(`/chat/rooms/${roomId}/messages`), // 메시지 내역
  sendMessage: (data) => api.post('/chat/messages', data), // 메시지 저장
};

// === [15. 공유 장바구니 API] ===
export const cartAPI = {
  getCart: (tableId) => api.get(`/cart/${tableId}`), // 테이블 장바구니 조회
  updateItem: (tableId, data) => api.post(`/cart/${tableId}`, data), // 아이템 추가/수정
  clearCart: (tableId) => api.delete(`/cart/${tableId}`), // 장바구니 초기화
};

// === [16. 스마트 웨이팅 API] ===
export const waitingAPI = {
  getStatus: (storeId) => api.get(`/waiting/store/${storeId}/status`), // 매장 대기 현황 (팀수)
  register: (data) => api.post('/waiting/register', data), // 대기 등록
  cancel: (id) => api.patch(`/waiting/${id}/status`, { status: 'cancelled' }), // 대기 취소
  getMyWaiting: (phone) => api.get(`/waiting/my/${phone}`), // 내 대기 정보 조회
};

// === [16-2. 스마트 예약 API] ===
export const reservationsAPI = {
  register: (data) => api.post('/reservations/register', data), // 예약 신청
  getByStore: (storeId, params) => api.get(`/reservations/store/${storeId}`, { params }), // 매장별 예약 조회
  updateStatus: (id, status) => api.patch(`/reservations/${id}/status`, { status }), // 예약 상태 변경
  cancel: (id, phone) => api.patch(`/reservations/${id}/cancel`, { phone }), // 내 예약 취소 (고객)
  getMyReservations: (phone) => api.get(`/reservations/my/${phone}`), // 내 예약 조회
};

// === [17. 소셜 리뷰 API] ===
export const reviewsAPI = {
  getStoreReviews: (storeId) => api.get(`/reviews/store/${storeId}`), // 매장 리뷰 조회
  getFeed: () => api.get('/reviews/feed'), // 소셜 피드 조회
  create: (data) => api.post('/reviews', data), // 리뷰 작성
  toggleLike: (id, userPhone) => api.post(`/reviews/${id}/like`, { user_phone: userPhone }), // 좋아요/취소
};

// === [18. AI 서비스 및 상품 관리 API] ===
export const aiAPI = {
  // AI 서비스
  describeMenu: (data) => api.post('/ai/describe-menu', data), // AI 메뉴 설명 생성
  recommend: (data) => api.post('/ai/recommend', data), // 맞춤 메뉴 추천
  translate: (text, targetLang) => api.post('/ai/translate', { text, targetLang }), // AI 실시간 번역
  storytelling: (data) => api.post('/ai/storytelling', data),
  analyzeMenuList: (data) => api.post('/ai/analyze-menu-list', data),
  recommendEnhancement: (description) => api.post('/ai/recommend-enhancement', { description }),
  translateMenu: (storeId, targetLang) => api.post('/ai/translate-menu', { store_id: storeId, targetLang }), // 메뉴 전체 번역
  recommendPersonalized: (data) => api.post('/ai/recommend', data), // 개인화 메뉴 추천 (기분, 이력 포함)
  recommendDessert: (data) => api.post('/ai/recommend-dessert', data), // 후식 추천
  proposeMenuFull: (data) => api.post('/ai/propose-menu-full', data), // 종합 메뉴 제안 (마법사용)
};

// === [19. 옵션 템플릿 API] ===
export const optionTemplatesAPI = {
  getByStore: (storeId) => api.get(`/option-templates/store/${storeId}`),
  create: (data) => api.post('/option-templates', data),
  update: (id, data) => api.put(`/option-templates/${id}`, data),
  delete: (id) => api.delete(`/option-templates/${id}`)
};

export const uploadsAPI = {
  uploadImage: (formData) => api.post('/uploads/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadImages: (formData) => api.post('/uploads/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteImage: (filename) => api.delete(`/uploads/image/${filename}`)
};

// === [13. 소켓 유틸리티] ===
export const getSocket = () => {
  if (window.orderSocket) return window.orderSocket;
  return null;
};

// === [14. 재고 관리 API] ===
export const inventoryAPI = {
  // 매장 재고 현황 목록
  getInventory: (storeId, params = {}) =>
    api.get(`/inventory/store/${storeId}`, { params }),

  // 매장 전체 재고 이력
  getStoreHistory: (storeId, params = {}) =>
    api.get(`/inventory/store/${storeId}/history`, { params }),

  // 저재고 알림 목록
  getLowStockAlerts: (storeId) =>
    api.get(`/inventory/store/${storeId}/alerts`),

  // 재고 수동 조정 (입출고)
  adjustStock: (productId, data) =>
    api.put(`/inventory/products/${productId}/stock`, data),

  // 재고 절대값 설정
  setStock: (productId, data) =>
    api.put(`/inventory/products/${productId}/stock/set`, data),

  // 상품별 재고 이력
  getProductHistory: (productId, params = {}) =>
    api.get(`/inventory/products/${productId}/history`, { params }),
};

export default api;



