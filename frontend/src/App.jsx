import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { lazy, Suspense, useState, useEffect, memo } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { logError } from "@/lib/errorUtils";

// Lazy imports
import {
  Index, MenuPage, PaymentSuccess, PaymentFail, QrResolvePage,
  MenuDemo, BusinessDemo, AuthPage, Register, StoreSearchPage,
  NotFound, KioskPage, ProfilePage, KitchenDisplayPage, LegalPage,
  StoreDisplay, FoodTruckLanding, FoodTruckDesignShowcase,
  FeaturesPage, PricingPage, GuidesPage, NewsPage, ContactPage,
  BoardList, BoardDetail, BoardWrite, PlanUpgrade,
  AdminLayout, MasterDashboard, MultiStoreSupervisorDashboard,
  StoreSetupWizard, StoreForm, OrderManager, MenuManager, MenuBuilder,
  StaffManager, SalesStats, ReviewManager, AnalyticsDashboard,
  SettlementManager, BusinessSettings, SystemStatus, ReceiptSettings,
  CustomerManager, CampaignDashboard, ReservationManager, BulkSMSManager,
  StoreEnrichment, InventoryManager, TableManager, StoreSettings,
  LegalSettings, NotificationTemplatesManager, DeveloperConsole,
  QrCustomizer, PartnershipManager, StaffScheduler,
  FoodTruckOwnerDashboard, FoodTruckAnalyticsDashboard,
   AlimtalkDeliveryConsole, CommunityPage,
   TinkerBellManagerPage,
 } from "@/routes/lazyImports";

import PWAInstallBanner from "@/components/common/PWAInstallBanner";
import PWAUpdateNotification from "@/components/common/PWAUpdateNotification";
import OfflineBanner from "@/components/common/OfflineBanner";
import { ErrorBoundary, ErrorFallback } from "@/components/common/ErrorBoundary";

const queryClient = new QueryClient();

const SPINNER_FALLBACK = (
  <div className="min-h-screen bg-white flex items-center justify-center">
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
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

// Export for route groups
export { AdminSuspense, ProtectedRoute, ValidStoreRoute, AdminPage };

const AppRoutes = memo(() => (
  <Routes>
    {/* Public Routes */}
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
    <Route path="/news" element={<AdminSuspense><NewsPage /></AdminSuspense>} />
    <Route path="/contact" element={<AdminSuspense><ContactPage /></AdminSuspense>} />

    {/* Admin Routes */}
    <Route path="/admin" element={<AdminPage><AdminSuspense><MasterDashboard /></AdminSuspense></AdminPage>} />
    <Route path="/admin/supervisor" element={<AdminPage><AdminSuspense><MultiStoreSupervisorDashboard /></AdminSuspense></AdminPage>} />
    <Route path="/admin/setup" element={<ProtectedRoute><AdminSuspense><StoreSetupWizard /></AdminSuspense></ProtectedRoute>} />
    <Route path="/admin/stores/new" element={<AdminPage><AdminSuspense><StoreForm /></AdminSuspense></AdminPage>} />
    <Route path="/admin/stores/:id/edit" element={<AdminPage><AdminSuspense><StoreForm isEdit /></AdminSuspense></AdminPage>} />
    <Route path="/admin/stores/:storeId/orders" element={<AdminPage><ValidStoreRoute><AdminSuspense><OrderManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/menu" element={<AdminPage><ValidStoreRoute><AdminSuspense><MenuManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/visual-builder" element={<AdminPage><ValidStoreRoute><AdminSuspense><MenuBuilder /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/staff" element={<AdminPage><ValidStoreRoute><AdminSuspense><StaffManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/sales" element={<AdminPage><ValidStoreRoute><AdminSuspense><SalesStats /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/reviews" element={<AdminPage><ValidStoreRoute><AdminSuspense><ReviewManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/analytics" element={<AdminPage><ValidStoreRoute><AdminSuspense><AnalyticsDashboard /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/settlements" element={<AdminPage><ValidStoreRoute><AdminSuspense><SettlementManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/settings" element={<AdminPage><ValidStoreRoute><AdminSuspense><BusinessSettings /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/system" element={<AdminPage><ValidStoreRoute><AdminSuspense><SystemStatus /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/receipt" element={<AdminPage><ValidStoreRoute><AdminSuspense><ReceiptSettings /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/customers" element={<AdminPage><ValidStoreRoute><AdminSuspense><CustomerManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/campaigns" element={<AdminPage><ValidStoreRoute><AdminSuspense><CampaignDashboard /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/reservations" element={<AdminPage><ValidStoreRoute><AdminSuspense><ReservationManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/bulk-sms" element={<AdminPage><ValidStoreRoute><AdminSuspense><BulkSMSManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/enrichment" element={<AdminPage><ValidStoreRoute><AdminSuspense><StoreEnrichment /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/inventory" element={<AdminPage><ValidStoreRoute><AdminSuspense><InventoryManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/tables" element={<AdminPage><ValidStoreRoute><AdminSuspense><TableManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/store-settings" element={<AdminPage><ValidStoreRoute><AdminSuspense><StoreSettings /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/legal" element={<AdminPage><ValidStoreRoute><AdminSuspense><LegalSettings /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/notifications" element={<AdminPage><ValidStoreRoute><AdminSuspense><NotificationTemplatesManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/developer" element={<AdminPage><ValidStoreRoute><AdminSuspense><DeveloperConsole /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/qr-customizer" element={<AdminPage><ValidStoreRoute><AdminSuspense><QrCustomizer /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/partnerships" element={<AdminPage><ValidStoreRoute><AdminSuspense><PartnershipManager /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/staff-scheduler" element={<AdminPage><ValidStoreRoute><AdminSuspense><StaffScheduler /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/alimtalk" element={<AdminPage><ValidStoreRoute><AdminSuspense><AlimtalkDeliveryConsole /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/community" element={<AdminPage><ValidStoreRoute><AdminSuspense><CommunityPage /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/kitchen" element={<AdminPage><ValidStoreRoute><AdminSuspense><KitchenDisplayPage /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/profile" element={<AdminPage><ValidStoreRoute><AdminSuspense><ProfilePage /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/tinkerbell" element={<AdminPage><AdminSuspense><TinkerBellManagerPage /></AdminSuspense></AdminPage>} />
    <Route path="/admin/stores/:storeId/tinkerbell" element={<AdminPage><ValidStoreRoute><AdminSuspense><TinkerBellManagerPage /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/system-status" element={<AdminPage><AdminSuspense><SystemStatus /></AdminSuspense></AdminPage>} />
    <Route path="/admin/bulk-sms" element={<AdminPage><AdminSuspense><BulkSMSManager /></AdminSuspense></AdminPage>} />
    <Route path="/admin/community" element={<AdminPage><AdminSuspense><CommunityPage /></AdminSuspense></AdminPage>} />
    <Route path="/admin/stores/:storeId/plan" element={<AdminPage><ValidStoreRoute><AdminSuspense><PlanUpgrade /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/board" element={<AdminPage><ValidStoreRoute><AdminSuspense><BoardList /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/board/:postId" element={<AdminPage><ValidStoreRoute><AdminSuspense><BoardDetail /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/board/write" element={<AdminPage><ValidStoreRoute><AdminSuspense><BoardWrite /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/foodtruck" element={<AdminPage><ValidStoreRoute><AdminSuspense><FoodTruckOwnerDashboard /></AdminSuspense></ValidStoreRoute></AdminPage>} />
    <Route path="/admin/stores/:storeId/foodtruck/analytics" element={<AdminPage><ValidStoreRoute><AdminSuspense><FoodTruckAnalyticsDashboard /></AdminSuspense></ValidStoreRoute></AdminPage>} />

    {/* Food Truck & Other Pages */}
    <Route path="/foodtruck" element={<AdminSuspense><FoodTruckLanding /></AdminSuspense>} />
    <Route path="/foodtruck/design" element={<AdminSuspense><FoodTruckDesignShowcase /></AdminSuspense>} />
    <Route path="/legal/:slug" element={<AdminSuspense><LegalPage /></AdminSuspense>} />
    <Route path="/store/:slug" element={<AdminSuspense><StoreDisplay /></AdminSuspense>} />

    {/* 404 */}
    <Route path="*" element={<AdminSuspense><NotFound /></AdminSuspense>} />
  </Routes>
));

const App = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <ErrorBoundary
                onError={logError}
                FallbackComponent={ErrorFallback}
              />
              {!isOnline && <OfflineBanner />}
              <PWAInstallBanner />
              <PWAUpdateNotification />
              <AppRoutes />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
