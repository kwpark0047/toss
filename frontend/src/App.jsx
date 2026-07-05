import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { lazy, Suspense, useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
// 공개 페이지 지연 로딩: 각 라우트가 자기 청크만 로드해 초기 번들(index) 축소
const Index = lazy(() => import("./pages/Index"));
const MenuPage = lazy(() => import("./pages/MenuPage"));
const QrResolvePage = lazy(() => import("./pages/QrResolvePage"));
const MenuDemo = lazy(() => import("./components/customer/MenuDemo"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Register = lazy(() => import("./components/Register"));
const StoreSearchPage = lazy(() => import("./pages/StoreSearchPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
import PWAInstallBanner from "@/components/common/PWAInstallBanner";
import PWAUpdateNotification from "@/components/common/PWAUpdateNotification";
import OfflineBanner from "@/components/common/OfflineBanner";

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

const queryClient = new QueryClient();

const AdminSuspense = ({ children }) => (
  <Suspense fallback={
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  }>
    {children}
  </Suspense>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
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
};

// storeId가 "undefined" 문자열이거나 없으면 대시보드로 리다이렉트
const ValidStoreRoute = ({ children }) => {
  const { storeId } = useParams();
  if (!storeId || storeId === 'undefined') {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
};

// Admin Layout Wrapper
const AdminPage = ({ children }) => (
  <ProtectedRoute>
    <AdminSuspense>
      <AdminLayout>
        {children}
      </AdminLayout>
    </AdminSuspense>
  </ProtectedRoute>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<AdminSuspense><Index /></AdminSuspense>} />
    <Route path="/auth" element={<AdminSuspense><AuthPage /></AdminSuspense>} />
    <Route path="/login" element={<Navigate to="/auth" replace />} />
    <Route path="/register" element={<AdminSuspense><Register /></AdminSuspense>} />
    <Route path="/search" element={<AdminSuspense><StoreSearchPage /></AdminSuspense>} />
    <Route path="/menu/demo" element={<AdminSuspense><MenuDemo /></AdminSuspense>} />
    <Route path="/menu/:storeId" element={<AdminSuspense><MenuPage /></AdminSuspense>} />
    <Route path="/qr/:qrCode" element={<AdminSuspense><QrResolvePage /></AdminSuspense>} />

    {/* Admin 메인 대시보드 */}
    <Route path="/admin" element={
      <AdminPage>
        <AdminSuspense><MasterDashboard /></AdminSuspense>
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

    {/* 공개 법적 문서 (이용약관·개인정보처리방침·환불정책) — 인증 불필요 */}
    <Route path="/legal/:storeId/:type" element={<Suspense fallback={null}><LegalPage /></Suspense>} />

    {/* 커뮤니티 게시판 (구체적 경로 먼저) */}
    <Route path="/kitchen/:storeId" element={
      <ProtectedRoute><AdminSuspense><KitchenDisplayPage /></AdminSuspense></ProtectedRoute>
    } />
    <Route path="/board/posts/:id" element={<AdminSuspense><BoardDetail /></AdminSuspense>} />
    <Route path="/board/write" element={<AdminSuspense><BoardWrite /></AdminSuspense>} />
    <Route path="/board/edit/:id" element={<AdminSuspense><BoardWrite /></AdminSuspense>} />
    <Route path="/board/:type" element={<AdminSuspense><BoardList /></AdminSuspense>} />
    <Route path="/board" element={<AdminSuspense><BoardList /></AdminSuspense>} />

    {/* 404 */}
    <Route path="*" element={<AdminSuspense><NotFound /></AdminSuspense>} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineBanner />
      <PWAUpdateNotification />
      <PWAInstallBanner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
