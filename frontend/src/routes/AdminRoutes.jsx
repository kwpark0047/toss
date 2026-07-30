import { Routes, Route, Navigate } from "react-router";
import { AdminSuspense } from "./AppRoutes";
import { ProtectedRoute, AdminPage, ValidStoreRoute } from "./AppRoutes";
import {
  Index, AuthPage, Register, StoreSearchPage,
  MenuDemo, BusinessDemo, MenuPage, PaymentSuccess, PaymentFail,
  KioskPage, QrResolvePage, FeaturesPage, PricingPage, GuidesPage,
  NewsPage, ContactPage, TinkerBellManagerPage, PlanUpgrade, ProfilePage,
  BoardList, BoardDetail, BoardWrite,
  AlimtalkDeliveryConsole, AnalyticsDashboard, BulkSMSManager, BusinessSettings, CampaignDashboard,
  CommunityPage, CustomerManager, DeveloperConsole, FoodTruckAnalyticsDashboard, FoodTruckDesignShowcase,
  FoodTruckLanding, FoodTruckOwnerDashboard, InventoryManager, KitchenDisplayPage,
  LegalPage, LegalSettings, MasterDashboard, MenuBuilder, MenuManager,
  MultiStoreSupervisorDashboard, NotificationTemplatesManager, OrderManager, PartnershipManager,
  QrCustomizer, ReceiptSettings, ReservationManager, ReviewManager,
  SalesStats, SettlementManager, StaffManager, StaffScheduler,
  StoreDisplay, StoreEnrichment, StoreForm, StoreSettings, StoreSetupWizard,
  SystemStatus, TableManager
} from "@/routes/lazyImports";

// Public routes
export const PublicRoutes = () => (
  <>
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
  </>
);

// Admin routes
export const AdminRoutes = () => (
  <>
    <Route path="/admin" element={
      <AdminPage>
        <AdminSuspense><MasterDashboard /></AdminSuspense>
      </AdminPage>
    } />

    <Route path="/admin/supervisor" element={
      <AdminPage>
        <AdminSuspense><MultiStoreSupervisorDashboard /></AdminSuspense>
      </AdminPage>
    } />

    <Route path="/admin/setup" element={
      <ProtectedRoute>
        <AdminSuspense><StoreSetupWizard /></AdminSuspense>
      </ProtectedRoute>
    } />

    <Route path="/admin/stores/new" element={
      <AdminPage>
        <AdminSuspense><StoreForm /></AdminSuspense>
      </AdminPage>
    } />

    <Route path="/admin/stores/:id/edit" element={
      <AdminPage>
        <AdminSuspense><StoreForm isEdit /></AdminSuspense>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/orders" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><OrderManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/menu" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><MenuManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/visual-builder" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><MenuBuilder /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/staff" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><StaffManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/sales" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><SalesStats /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/reviews" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><ReviewManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/analytics" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><AnalyticsDashboard /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/settlements" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><SettlementManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/settings" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><BusinessSettings /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/system" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><SystemStatus /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/receipt" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><ReceiptSettings /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/customers" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><CustomerManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/campaigns" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><CampaignDashboard /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/reservations" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><ReservationManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/bulk-sms" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><BulkSMSManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/enrichment" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><StoreEnrichment /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/inventory" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><InventoryManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/tables" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><TableManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/store-settings" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><StoreSettings /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/legal" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><LegalSettings /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/notifications" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><NotificationTemplatesManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/developer" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><DeveloperConsole /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/qr-customizer" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><QrCustomizer /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/partnerships" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><PartnershipManager /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/staff-scheduler" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><StaffScheduler /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/alimtalk" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><AlimtalkDeliveryConsole /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/community" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><CommunityPage /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/kitchen" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><KitchenDisplayPage /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/profile" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><ProfilePage /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/tinkerbell" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><TinkerBellManagerPage /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/plan" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><PlanUpgrade /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/board" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><BoardList /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/board/:postId" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><BoardDetail /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/board/write" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><BoardWrite /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/foodtruck" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><FoodTruckOwnerDashboard /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/admin/stores/:storeId/foodtruck/analytics" element={
      <AdminPage>
        <ValidStoreRoute><AdminSuspense><FoodTruckAnalyticsDashboard /></AdminSuspense></ValidStoreRoute>
      </AdminPage>
    } />

    <Route path="/foodtruck" element={<AdminSuspense><FoodTruckLanding /></AdminSuspense>} />
    <Route path="/foodtruck/design" element={<AdminSuspense><FoodTruckDesignShowcase /></AdminSuspense>} />
    <Route path="/legal/:slug" element={<AdminSuspense><LegalPage /></AdminSuspense>} />
    <Route path="/store/:slug" element={<AdminSuspense><StoreDisplay /></AdminSuspense>} />
  </>
);
