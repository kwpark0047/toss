import { lazy } from 'react';

// 공개 페이지 지연 로딩
export const Index = lazy(() => import('../pages/Index'));
export const MenuPage = lazy(() => import('../pages/MenuPage'));
export const PaymentSuccess = lazy(() => import('../pages/PaymentSuccess'));
export const PaymentFail = lazy(() => import('../pages/PaymentFail'));
export const QrResolvePage = lazy(() => import('../pages/QrResolvePage'));
export const MenuDemo = lazy(() => import('../components/customer/MenuDemo'));
export const BusinessDemo = lazy(() => import('../components/admin/BusinessDemo'));
export const AuthPage = lazy(() => import('../pages/AuthPage'));
export const Register = lazy(() => import('../components/Register'));
export const StoreSearchPage = lazy(() => import('../pages/StoreSearchPage'));
export const NotFound = lazy(() => import('../pages/NotFound'));
export const KioskPage = lazy(() => import('../pages/KioskPage'));
export const ProfilePage = lazy(() => import('../pages/ProfilePage'));
export const KitchenDisplayPage = lazy(() => import('../pages/KitchenDisplay'));
export const LegalPage = lazy(() => import('../pages/LegalPage'));
export const StoreDisplay = lazy(() => import('../pages/StoreDisplay'));
export const FoodTruckLanding = lazy(() => import('../pages/FoodTruckLanding'));
export const FoodTruckDesignShowcase = lazy(() => import('../pages/FoodTruckDesignShowcase'));
export const TinkerBellManagerPage = lazy(() => import('../pages/TinkerBellManagerPage'));
export const PlanUpgrade = lazy(() => import('../pages/PlanUpgrade'));

// 마케팅 페이지
export const FeaturesPage = lazy(() => import('../pages/marketing/FeaturesPage'));
export const PricingPage = lazy(() => import('../pages/marketing/PricingPage'));
export const GuidesPage = lazy(() => import('../pages/marketing/GuidesPage'));
export const NewsPage = lazy(() => import('../pages/marketing/NewsPage'));
export const ContactPage = lazy(() => import('../pages/marketing/ContactPage'));

// 게시판
export const BoardList = lazy(() => import('../components/board/BoardList'));
export const BoardDetail = lazy(() => import('../components/board/BoardDetail'));
export const BoardWrite = lazy(() => import('../components/board/BoardWrite'));

// Admin 컴포넌트 지연 로딩
export const AdminLayout = lazy(() => import('../components/admin/AdminLayout'));
export const MasterDashboard = lazy(() => import('../components/admin/MasterDashboard'));
export const OrderManager = lazy(() => import('../components/admin/OrderManager'));
export const MenuManager = lazy(() => import('../components/admin/MenuManager'));
export const MenuBuilder = lazy(() => import('../components/admin/MenuBuilder'));
export const StaffManager = lazy(() => import('../components/admin/StaffManager'));
export const SalesStats = lazy(() => import('../components/admin/SalesStats'));
export const ReviewManager = lazy(() => import('../components/admin/ReviewManager'));
export const AnalyticsDashboard = lazy(() => import('../components/admin/AnalyticsDashboard'));
export const SettlementManager = lazy(() => import('../components/admin/SettlementManager'));
export const BusinessSettingsWithTheme = lazy(
  () => import('../components/admin/BusinessSettingsWithTheme')
);
export const SystemStatus = lazy(() => import('../components/admin/SystemStatus'));
export const ReceiptSettings = lazy(() => import('../components/admin/ReceiptSettings'));
export const CustomerManager = lazy(() => import('../components/admin/CustomerManager'));
export const CampaignDashboard = lazy(() => import('../components/admin/CampaignDashboard'));
export const ReservationManager = lazy(() => import('../components/admin/ReservationManager'));
export const WaitingManager = lazy(() => import('../components/admin/WaitingManager'));
export const StoreForm = lazy(() => import('../components/admin/StoreForm'));
export const BulkSMSManager = lazy(() => import('../components/admin/BulkSMSManager'));
export const StoreEnrichment = lazy(() => import('../components/admin/StoreEnrichment'));
export const InventoryManager = lazy(() => import('../components/admin/InventoryManager'));
export const TableManager = lazy(() => import('../components/admin/TableManager'));
export const StoreSetupWizard = lazy(() => import('../components/admin/StoreSetupWizard'));
export const CommunityPage = lazy(() => import('../components/admin/CommunityPage'));
export const LegalSettings = lazy(() => import('../components/admin/LegalSettings'));
export const StoreSettings = lazy(() => import('../components/admin/StoreSettings'));
export const NotificationTemplatesManager = lazy(
  () => import('../components/admin/NotificationTemplatesManager')
);
export const DeveloperConsole = lazy(() => import('../components/admin/DeveloperConsole'));
export const QrCustomizer = lazy(() => import('../components/admin/QrCustomizer'));
export const PartnershipManager = lazy(() => import('../components/admin/PartnershipManager'));
export const StaffScheduler = lazy(() => import('../components/admin/StaffScheduler'));
export const FoodTruckOwnerDashboard = lazy(
  () => import('../components/admin/FoodTruckOwnerDashboard')
);
export const FoodTruckAnalyticsDashboard = lazy(
  () => import('../components/admin/FoodTruckAnalyticsDashboard')
);
export const MultiStoreSupervisorDashboard = lazy(
  () => import('../components/admin/MultiStoreSupervisorDashboard')
);
export const AlimtalkDeliveryConsole = lazy(
  () => import('../components/admin/AlimtalkDeliveryConsole')
);
export const PlanRequestsManage = lazy(() => import('../pages/PlanRequestsManage'));
