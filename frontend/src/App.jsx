import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import MenuPage from "./pages/MenuPage";
import AuthPage from "./pages/AuthPage";
import Register from "./components/Register";
import StoreSearchPage from "./pages/StoreSearchPage";
import NotFound from "./pages/NotFound";
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
const AnalyticsDashboard = lazy(() => import("@/components/admin/AnalyticsDashboard"));
const SettlementManager  = lazy(() => import("@/components/admin/SettlementManager"));
const ReceiptSettings    = lazy(() => import("@/components/admin/ReceiptSettings"));
const CustomerManager    = lazy(() => import("@/components/admin/CustomerManager"));
const ReservationManager = lazy(() => import("@/components/admin/ReservationManager"));
const StoreForm          = lazy(() => import("@/components/admin/StoreForm"));
const BulkSMSManager     = lazy(() => import("@/components/admin/BulkSMSManager"));
const InventoryManager   = lazy(() => import("@/components/admin/InventoryManager"));
const ProfilePage        = lazy(() => import("@/pages/ProfilePage"));

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
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
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/login" element={<Navigate to="/auth" replace />} />
    <Route path="/register" element={<Register />} />
    <Route path="/search" element={<StoreSearchPage />} />
    <Route path="/menu/:storeId" element={<MenuPage />} />

    {/* Admin 메인 대시보드 */}
    <Route path="/admin" element={
      <AdminPage>
        <AdminSuspense><MasterDashboard /></AdminSuspense>
      </AdminPage>
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
        <AdminSuspense><OrderManager /></AdminSuspense>
      </AdminPage>
    } />

    {/* 메뉴 관리 */}
    <Route path="/admin/stores/:storeId/menu" element={
      <AdminPage>
        <AdminSuspense><MenuManager /></AdminSuspense>
      </AdminPage>
    } />

    {/* 메뉴판 비주얼 빌더 */}
    <Route path="/admin/stores/:storeId/visual-builder" element={
      <AdminPage>
        <AdminSuspense><MenuBuilder /></AdminSuspense>
      </AdminPage>
    } />

    {/* 직원 관리 */}
    <Route path="/admin/stores/:storeId/staff" element={
      <AdminPage>
        <AdminSuspense><StaffManager /></AdminSuspense>
      </AdminPage>
    } />

    {/* 매출 통계 */}
    <Route path="/admin/stores/:storeId/stats" element={
      <AdminPage>
        <AdminSuspense><SalesStats /></AdminSuspense>
      </AdminPage>
    } />

    {/* 고급 분석 대시보드 */}
    <Route path="/admin/stores/:storeId/analytics" element={
      <AdminPage>
        <AdminSuspense><AnalyticsDashboard /></AdminSuspense>
      </AdminPage>
    } />

    {/* 정산 분석 */}
    <Route path="/admin/stores/:storeId/settlements" element={
      <AdminPage>
        <AdminSuspense><SettlementManager /></AdminSuspense>
      </AdminPage>
    } />

    {/* 영수증 설정 */}
    <Route path="/admin/stores/:storeId/receipt-settings" element={
      <AdminPage>
        <AdminSuspense><ReceiptSettings /></AdminSuspense>
      </AdminPage>
    } />

    {/* 단골 고객 관리 */}
    <Route path="/admin/stores/:storeId/customers" element={
      <AdminPage>
        <AdminSuspense><CustomerManager /></AdminSuspense>
      </AdminPage>
    } />

    {/* 예약 관리 */}
    <Route path="/admin/stores/:storeId/reservations" element={
      <AdminPage>
        <AdminSuspense><ReservationManager /></AdminSuspense>
      </AdminPage>
    } />

    {/* 재고 관리 */}
    <Route path="/admin/stores/:storeId/inventory" element={
      <AdminPage>
        <AdminSuspense><InventoryManager /></AdminSuspense>
      </AdminPage>
    } />

    {/* 매장 환경설정 */}
    <Route path="/admin/stores/:storeId/settings" element={
      <AdminPage>
        <AdminSuspense><StoreForm isEdit /></AdminSuspense>
      </AdminPage>
    } />

    {/* 대량 SMS 발송 */}
    <Route path="/admin/bulk-sms" element={
      <AdminPage>
        <AdminSuspense><BulkSMSManager /></AdminSuspense>
      </AdminPage>
    } />

    {/* 내 프로필 */}
    <Route path="/admin/profile" element={
      <AdminPage>
        <AdminSuspense><ProfilePage /></AdminSuspense>
      </AdminPage>
    } />

    {/* 404 */}
    <Route path="*" element={<NotFound />} />
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
