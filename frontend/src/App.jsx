import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { lazy, Suspense, useState, useEffect, memo } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
// 공개 페이지 지연 로딩: 각 라우트가 자기 청크만 로드해 초기 번들(index) 축소
const Index = lazy(() => import("./pages/Index"));
const MenuPage = lazy(() => import("./pages/MenuPage"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFail = lazy(() => import("./pages/PaymentFail"));
const QrResolvePage = lazy(() => import("./pages/QrResolvePage"));
const MenuDemo = lazy(() => import("./components/customer/MenuDemo"));
const BusinessDemo = lazy(() => import("./components/admin/BusinessDemo"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Register = lazy(() => import("./components/Register"));
const StoreSearchPage = lazy(() => import("./pages/StoreSearchPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const KioskPage = lazy(() => import("./pages/KioskPage"));
import PWAInstallBanner from "@/components/common/PWAInstallBanner";
import PWAUpdateNotification from "@/components/common/PWAUpdateNotification";
import OfflineBanner from "@/components/common/OfflineBanner";
import { ErrorBoundary, ErrorFallback } from "@/components/common/ErrorBoundary";

// Admin 컴포넌트 지연 로딩
const AdminLayout    = lazy(() => import("@/components/admin/AdminLayout"));
const MasterDashboard  = lazy(() => import("@/components/admin/MasterDashboard"));
const OrderManager     = lazy(() => import("@/components/admin/OrderManager"));
const MenuManager      = lazy(() => import("@/components/admin/MenuManager"));
const MenuBuilder      = lazy(() => import("@/components/admin/MenuBuilder"));
const StaffManager     = lazy(() => import("@/components/admin/StaffManager"));
const SalesStats       = lazy(() => import("@/components/admin/SalesStats"));
const ReviewManager    = lazy(() => import("@/components/admin/ReviewManager"));
const AnalyticsDashboard = lazy(() => import("@/components/admin/AnalyticsDashboard"));
const SettlementManager  = lazy(() => import("@/components/admin/SettlementManager"));
const BusinessSettings   = lazy(() => import("@/components/admin/BusinessSettings"));
const SystemStatus       = lazy(() => import("@/components/admin/SystemStatus"));
const ReceiptSettings    = lazy(() => import("@/components/admin/ReceiptSettings"));
const CustomerManager    = lazy(() => import("@/components/admin/CustomerManager"));
const ReservationManager = lazy(() => import("@/components/admin/ReservationManager"));
const StoreForm          = lazy(() => import("@/components/admin/StoreForm"));
const BulkSMSManager     = lazy(() => import("@/components/admin/BulkSMSManager"));
const StoreEnrichment    = lazy(() => import("@/components/admin/StoreEnrichment"));
const InventoryManager      = lazy(() => import("@/components/admin/InventoryManager"));
const TableManager          = lazy(() => import("@/components/admin/TableManager"));
const ProfilePage           = lazy(() => import("@/pages/ProfilePage"));
const TinkerBellManagerPage = lazy(() => import("@/pages/TinkerBellManagerPage"));
const StoreSetupWizard      = lazy(() => import("@/components/admin/StoreSetupWizard"));
const BoardList          = lazy(() => import("@/components/board/BoardList"));
const BoardDetail        = lazy(() => import("@/components/board/BoardDetail"));
const BoardWrite         = lazy(() => import("@/components/board/BoardWrite"));
const KitchenDisplayPage = lazy(() => import("@/pages/KitchenDisplay"));
const CommunityPage      = lazy(() => import("@/components/admin/CommunityPage"));
const LegalSettings      = lazy(() => import("@/components/admin/LegalSettings"));
const LegalPage          = lazy(() => import("@/pages/LegalPage"));
const StoreSettings      = lazy(() => import("@/components/admin/StoreSettings"));
const NotificationTemplatesManager = lazy(() => import("@/components/admin/NotificationTemplatesManager"));
const DeveloperConsole = lazy(() => import("@/components/admin/DeveloperConsole"));
const QrCustomizer = lazy(() => import("@/components/admin/QrCustomizer"));
const PartnershipManager = lazy(() => import("@/components/admin/PartnershipManager"));
const StaffScheduler = lazy(() => import("@/components/admin/StaffScheduler"));
const FoodTruckLanding = lazy(() => import("./pages/FoodTruckLanding"));
const FoodTruckOwnerDashboard = lazy(() => import("@/components/admin/FoodTruckOwnerDashboard"));
const FoodTruckDesignShowcase = lazy(() => import("./pages/FoodTruckDesignShowcase"));
const FoodTruckAnalyticsDashboard = lazy(() => import("@/components/admin/FoodTruckAnalyticsDashboard"));
const FeaturesPage = lazy(() => import("./pages/marketing/FeaturesPage"));
const PricingPage = lazy(() => import("./pages/marketing/PricingPage"));
const GuidesPage = lazy(() => import("./pages/marketing/GuidesPage"));
const ContactPage = lazy(() => import("./pages/marketing/ContactPage"));
const MultiStoreSupervisorDashboard = lazy(() => import("@/components/admin/MultiStoreSupervisorDashboard"));
const AlimtalkDeliveryConsole = lazy(() => import("@/components/admin/AlimtalkDeliveryConsole"));

const queryClient = new QueryClient();

const SPINNER_FALLBACK = (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const AdminSuspense = ({ children }) => (
  <ErrorBoundary onError={logError}>
    <Suspense fallback={SPINNER_FALLBACK}>
      {children}
    </Suspense>
  </ErrorBoundary>
);

// Protected Route Component
const ProtectedRoute = memo(({ children }) => {
  const { user, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 gap-4">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-xs">로그인 정보 확인 중...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
});

// storeId가 "undefined" 문자열이거나 없으면 대시보드로 리다이렉트
const ValidStoreRoute = memo(({ children }) => {
  const { storeId } = useParams();
  if (!storeId || storeId === 'undefined') {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
});

// Admin Layout Wrapper
const AdminPage = memo(({ children }) => (
  <ProtectedRoute>
    <AdminSuspense>
      <AdminLayout>
        {children}
      </AdminLayout>
    </AdminSuspense>
  </ProtectedRoute>
));

const AppRoutes = memo(() => (
  <Routes>
    <Route path="/" element={<AdminSuspense><Index /></AdminSuspense>} />
    <Route path="/auth" element={<AdminSuspense><AuthPage /></AdminSuspense>} />
    <Route path="/login" element={<Navigate to="/auth" replace />} />
    <Route path="/register" element={<AdminSuspense><Register /></AdminSuspense>} />
    <Route path="/search" element={<AdminSuspense><StoreSearchPage /></AdminSuspense>} />
    <Route path="/menu/demo" element={<AdminSuspense><MenuDemo /></AdminSuspense>} />
    <Route path="/demo/business" element={<AdminSuspense><BusinessDemo /></AdminSuspense>} />
    <Route path="/menu/:storeId" element={<AdminSuspense><MenuPage /></AdminSuspense>} />
    <Route path="/payment/success" element={<AdminSuspense><PaymentSuccess /></AdminSuspense>} />
    <Route path="/payment/fail" element={<AdminSuspense><PaymentFail /></AdminSuspense>} />
    <Route path="/kiosk/:storeId" element={<AdminSuspense><KioskPage /></AdminSuspense>} />
    <Route path="/qr/:qrCode" element={<AdminSuspense><QrResolvePage /></AdminSuspense>} />
    <Route path="/features" element={<AdminSuspense><FeaturesPage /></AdminSuspense>} />
    <Route path="/pricing" element={<AdminSuspense><PricingPage /></AdminSuspense>} />
    <Route path="/guides" element={<AdminSuspense><GuidesPage /></AdminSuspense>} />
    <Route path="/contact" element={<AdminSuspense><ContactPage /></AdminSuspense>} />

    {/* Admin 메인 대시보드 */}
    <Route path="/admin" element={
      <AdminPage>
        <AdminSuspense><MasterDashboard /></AdminSuspense>
      </AdminPage>
    } />

    {/* 다점포 프랜차이즈 통합 슈퍼바이저 대시보드 */}
    <Route path="/admin/supervisor" element={
      <AdminPage>
        <AdminSuspense><MultiStoreSupervisorDashboard /></AdminSuspense>
      </AdminPage>
    } />

    {/* 첫 매장 설정 마법사 (팅커벨 온보딩) */}
    <Route path="/admin/setup" element={
      <ProtectedRoute>
        <AdminSuspense><StoreSetupWizard /></AdminSuspense>
      </ProtectedRoute>
    } />

    {/* 매장 생성 */}
    <Route path="/admin/stores/new" element={
      <AdminPage>
        <AdminSuspense><StoreForm /></AdminSuspense>
      </AdminPage>
    } />

    {/* 매장 수정 */}
    <Route path="/admin/stores/:id/edit" element={
      <AdminPage>
        <AdminSuspense><StoreForm isEdit /></AdminSuspense>
      </AdminPage>
    } />

    {/* 주문 관리 */}
    <Route path="/admin/stores/:storeId/orders" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><OrderManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 메뉴 관리 */}
    <Route path="/admin/stores/:storeId/menu" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><MenuManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 메뉴판 비주얼 빌더 */}
    <Route path="/admin/stores/:storeId/visual-builder" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><MenuBuilder /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 직원 관리 */}
    <Route path="/admin/stores/:storeId/staff" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><StaffManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 매출 통계 */}
    <Route path="/admin/stores/:storeId/stats" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><SalesStats /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 리뷰 관리 */}
    <Route path="/admin/stores/:storeId/reviews" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><ReviewManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 고급 분석 대시보드 */}
    <Route path="/admin/stores/:storeId/analytics" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><AnalyticsDashboard /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 정산 분석 */}
    <Route path="/admin/stores/:storeId/settlements" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><SettlementManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 시스템 현황 */}
    <Route path="/admin/system-status" element={
      <AdminPage>
        <AdminSuspense><SystemStatus /></AdminSuspense>
      </AdminPage>
    } />

    {/* 사업자 & 결제 설정 */}
    <Route path="/admin/stores/:storeId/business-settings" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><BusinessSettings /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 영수증 설정 */}
    <Route path="/admin/stores/:storeId/receipt-settings" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><ReceiptSettings /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 단골 고객 관리 */}
    <Route path="/admin/stores/:storeId/customers" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><CustomerManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 예약 관리 */}
    <Route path="/admin/stores/:storeId/reservations" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><ReservationManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 재고 관리 */}
    <Route path="/admin/stores/:storeId/inventory" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><InventoryManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 테이블 관리 */}
    <Route path="/admin/stores/:storeId/tables" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><TableManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 매장 환경설정 */}
    <Route path="/admin/stores/:storeId/settings" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><StoreSettings /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 대량 SMS 발송 */}
    <Route path="/admin/bulk-sms" element={
      <AdminPage>
        <AdminSuspense><BulkSMSManager /></AdminSuspense>
      </AdminPage>
    } />
    <Route path="/admin/enrich-stores" element={
      <AdminPage>
        <AdminSuspense><StoreEnrichment /></AdminSuspense>
      </AdminPage>
    } />

    {/* AI 팅커벨 도우미 */}
    <Route path="/admin/tinkerbell" element={
      <AdminPage>
        <AdminSuspense><TinkerBellManagerPage /></AdminSuspense>
      </AdminPage>
    } />

    {/* 내 프로필 */}
    <Route path="/admin/profile" element={
      <AdminPage>
        <AdminSuspense><ProfilePage /></AdminSuspense>
      </AdminPage>
    } />

    {/* 지역 커뮤니티 */}
    <Route path="/admin/community" element={
      <AdminPage>
        <AdminSuspense><CommunityPage /></AdminSuspense>
      </AdminPage>
    } />

    {/* 법적 의무 정보 관리 (관리자) */}
    <Route path="/admin/stores/:storeId/legal" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><LegalSettings /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 알림 템플릿 관리 */}
    <Route path="/admin/stores/:storeId/notification-templates" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><NotificationTemplatesManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 개발자 콘솔 (Open Commerce Hub API · 웹훅) */}
    <Route path="/admin/stores/:storeId/developer" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><DeveloperConsole /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* QR 코드 커스터마이징 (F6) */}
    <Route path="/admin/stores/:storeId/qr-customizer" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><QrCustomizer /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 제휴 마케팅 (F7) */}
    <Route path="/admin/stores/:storeId/partnerships" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><PartnershipManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 근무표 */}
    <Route path="/admin/stores/:storeId/schedules" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><StaffScheduler /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 푸드트럭 고객용 실시간 위치 정보 랜딩 */}
    <Route path="/foodtruck/landing" element={<AdminSuspense><FoodTruckLanding /></AdminSuspense>} />

    {/* 푸드트럭 5가지 디자인 쇼케이스 */}
    <Route path="/foodtruck/showcase" element={<AdminSuspense><FoodTruckDesignShowcase /></AdminSuspense>} />

    {/* 푸드트럭 점주용 위치 및 상태 어드민 */}
    <Route path="/admin/stores/:storeId/foodtruck" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><FoodTruckOwnerDashboard /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 푸드트럭 점주용 지능형 매출 분석 보고서 */}
    <Route path="/admin/stores/:storeId/foodtruck/analytics" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><FoodTruckAnalyticsDashboard /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 알림톡 실시간 전송 콘솔 */}
    <Route path="/admin/stores/:storeId/alimtalk" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><AlimtalkDeliveryConsole /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    {/* 공개 법적 문서 (이용약관·개인정보처리방침·환불정책) — 인증 불필요 */}
    <Route path="/legal/:storeId/:type" element={<Suspense fallback={null}><LegalPage /></Suspense>} />

    {/* 커뮤니티 게시판 (구체적 경로 먼저) */}
    <Route path="/kitchen/:storeId" element={
      <ProtectedRoute><AdminSuspense><KitchenDisplayPage /></AdminSuspense></ProtectedRoute>
    } />
    {/* 게시판은 AdminLayout(다크 셸) 안에서 렌더 — 다른 관리자 페이지와 UI 일관.
        AdminLayout이 공개 게시판(목록·상세) 접근을 허용하고, 글쓰기/수정은 로그인 요구 */}
    <Route path="/board/posts/:id" element={<AdminSuspense><AdminLayout><BoardDetail /></AdminLayout></AdminSuspense>} />
    <Route path="/board/write" element={<AdminSuspense><AdminLayout><BoardWrite /></AdminLayout></AdminSuspense>} />
    <Route path="/board/edit/:id" element={<AdminSuspense><AdminLayout><BoardWrite /></AdminLayout></AdminSuspense>} />
    <Route path="/board/:type" element={<AdminSuspense><AdminLayout><BoardList /></AdminLayout></AdminSuspense>} />
    <Route path="/board" element={<AdminSuspense><AdminLayout><BoardList /></AdminLayout></AdminSuspense>} />

    {/* 404 */}
    <Route path="*" element={<AdminSuspense><NotFound /></AdminSuspense>} />
  </Routes>
));

const logError = (error, errorInfo) => {
  if (import.meta.env.DEV) {
    console.error('[ErrorBoundary]', error.message, errorInfo?.componentStack);
  }
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineBanner />
      <PWAUpdateNotification />
      <ErrorBoundary
        fallback={<ErrorFallback error={new Error('앱을 불러올 수 없습니다.')} fullPage />}
        onError={logError}
      >
        <BrowserRouter>
          <AuthProvider>
            <PWAInstallBanner />
            <ErrorBoundary onError={logError}>
              <AppRoutes />
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
