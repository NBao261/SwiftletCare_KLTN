import { Suspense, lazy, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import MainLayout from "@/components/layout/MainLayout";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import RequireRole from "@/components/auth/RequireRole";
import { setNavigate } from "@/utils/navigation";
import { getRoleHomePath } from "@/constants/navigation";
import type { Role } from "@/types";

// Code-splitting theo route — tránh bundle chính kéo theo chart.js/date-fns
// (chỉ AnalyticsPage dùng) cho mọi user kể cả khi họ chưa từng vào /analytics.
// Cấu trúc thư mục pages/ theo role sở hữu (Public/Admin/FarmOwner/SalesStaff/
// Shared — Shared = dùng chung nhiều role cụ thể, xem RequireRole allow=... ở
// từng route bên dưới để biết chính xác role nào) — không có role nào "khơi
// khơi" ngoài các nhóm này.
const LoginPage = lazy(() => import("@/pages/Public/Auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/Public/Auth/RegisterPage"));
const ForgotPasswordPage = lazy(
  () => import("@/pages/Public/Auth/ForgotPasswordPage"),
);
const InvitationPage = lazy(
  () => import("@/pages/Public/Invitations/InvitationPage"),
);
const DashboardPage = lazy(
  () => import("@/pages/FarmOwner/Dashboard/DashboardPage"),
);
const FarmsPage = lazy(() => import("@/pages/Shared/Farms/FarmsPage"));
const FarmHousesPage = lazy(
  () => import("@/pages/Shared/Farms/FarmHousesPage"),
);
const FarmZonesPage = lazy(
  () => import("@/pages/Shared/Farms/FarmZonesPage"),
);
const DevicesPage = lazy(() => import("@/pages/Shared/Devices/DevicesPage"));
const AlertsPage = lazy(() => import("@/pages/Shared/Alerts/AlertsPage"));
const AnalyticsPage = lazy(
  () => import("@/pages/FarmOwner/Analytics/AnalyticsPage"),
);
const LiveStreamPage = lazy(
  () => import("@/pages/Shared/LiveStream/LiveStreamPage"),
);
const SettingsPage = lazy(
  () => import("@/pages/Shared/Settings/SettingsPage"),
);
const TicketsPage = lazy(() => import("@/pages/Shared/Tickets/TicketsPage"));
const TicketDetailPage = lazy(
  () => import("@/pages/Shared/Tickets/TicketDetailPage"),
);
const HarvestPage = lazy(() => import("@/pages/Shared/Harvest/HarvestPage"));
const MarketplacePage = lazy(
  () => import("@/pages/Public/Marketplace/MarketplacePage"),
);
const ListingDetailPage = lazy(
  () => import("@/pages/Public/Marketplace/ListingDetailPage"),
);
const ForbiddenPage = lazy(
  () => import("@/pages/Public/Forbidden/ForbiddenPage"),
);
const SalesHomePage = lazy(
  () => import("@/pages/SalesStaff/SalesHome/SalesHomePage"),
);
const AdminNodeStatusPage = lazy(
  () => import("@/pages/Admin/AdminNodeStatus/AdminNodeStatusPage"),
);
const UsersPage = lazy(() => import("@/pages/Admin/Users/UsersPage"));
const AccountRequestsPage = lazy(
  () => import("@/pages/Admin/AccountRequests/AccountRequestsPage"),
);

// Route ứng với công việc vận hành farm — Sales Staff chưa có màn hình nghiệp vụ
// riêng (module Bán hàng thuộc Giai đoạn 2, xem SalesHomePage) nên không thuộc nhóm này.
const OPS_ROLES: Role[] = ["FARM_OWNER", "TECHNICIAN", "ADMIN"];
// Dashboard/Analytics (giám sát môi trường chi tiết theo zone) là công cụ vận
// hành hằng ngày CỦA RIÊNG Farm Owner — Technician/Admin xử lý kỹ thuật/ticket,
// không cần chi tiết tới mức đó (xem constants/navigation.ts).
const FARM_OWNER_ONLY: Role[] = ["FARM_OWNER"];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const location = useLocation();

  // Chờ zustand/persist đọc xong localStorage trước khi quyết định — tránh
  // flash redirect về /login khi F5 một trang đã đăng nhập.
  if (!hasHydrated) return <RouteFallback />;

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}

/** Đăng ký navigate() của router vào bridge để client.ts (ngoài React tree) dùng được. */
function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate(navigate);
    return () => setNavigate(null);
  }, [navigate]);
  return null;
}

/** Trang mặc định sau khi vào "/" hoặc gõ URL không tồn tại — tuỳ role vì mỗi role có bộ trang riêng. */
function RoleHomeRedirect() {
  const role = useAuthStore((s) => s.user?.role);
  return <Navigate to={getRoleHomePath(role)} replace />;
}

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center p-6">
      <LoadingSkeleton className="h-24 w-full max-w-md" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <NavigationBridge />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/invitations/:token" element={<InvitationPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/marketplace/:id" element={<ListingDetailPage />} />
        <Route path="/403" element={<ForbiddenPage />} />

        {/* Protected – wrapped in sidebar layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleHomeRedirect />} />

          {/* Sales Staff chưa có màn hình vận hành farm nào — các route dưới đây
              chỉ dành cho FARM_OWNER/TECHNICIAN/ADMIN, chặn cả khi gõ thẳng URL. */}
          {/* Dashboard/Analytics (giám sát môi trường chi tiết) chỉ Farm Owner — Technician/Admin dùng Devices/Trạng thái hệ thống */}
          <Route
            path="dashboard"
            element={
              <RequireRole allow={FARM_OWNER_ONLY}>
                <DashboardPage />
              </RequireRole>
            }
          />
          <Route
            path="analytics"
            element={
              <RequireRole allow={FARM_OWNER_ONLY}>
                <AnalyticsPage />
              </RequireRole>
            }
          />
          <Route
            path="farms"
            element={
              <RequireRole allow={OPS_ROLES}>
                <FarmsPage />
              </RequireRole>
            }
          />
          <Route
            path="farms/:farmId"
            element={
              <RequireRole allow={OPS_ROLES}>
                <FarmHousesPage />
              </RequireRole>
            }
          />
          <Route
            path="farms/:farmId/houses/:houseId"
            element={
              <RequireRole allow={OPS_ROLES}>
                <FarmZonesPage />
              </RequireRole>
            }
          />
          <Route
            path="devices"
            element={
              <RequireRole allow={OPS_ROLES}>
                <DevicesPage />
              </RequireRole>
            }
          />
          <Route
            path="alerts"
            element={
              <RequireRole allow={OPS_ROLES}>
                <AlertsPage />
              </RequireRole>
            }
          />
          <Route
            path="stream/:id"
            element={
              <RequireRole allow={OPS_ROLES}>
                <LiveStreamPage />
              </RequireRole>
            }
          />
          <Route
            path="tickets"
            element={
              <RequireRole allow={OPS_ROLES}>
                <TicketsPage />
              </RequireRole>
            }
          />
          <Route
            path="tickets/:id"
            element={
              <RequireRole allow={OPS_ROLES}>
                <TicketDetailPage />
              </RequireRole>
            }
          />
          {/* Backend: toàn bộ router harvests chỉ requireRole(FARM_OWNER, ADMIN) */}
          <Route
            path="harvests"
            element={
              <RequireRole allow={["FARM_OWNER", "ADMIN"]}>
                <HarvestPage />
              </RequireRole>
            }
          />
          {/* Quản lý tài khoản người dùng toàn hệ thống — chỉ Admin */}
          <Route
            path="users"
            element={
              <RequireRole allow={["ADMIN"]}>
                <UsersPage />
              </RequireRole>
            }
          />
          {/* AUTH-FR-012 (xoá tài khoản) + AUTH-FR-005d (đề xuất Sales Staff) — chỉ Admin */}
          <Route
            path="account-requests"
            element={
              <RequireRole allow={["ADMIN"]}>
                <AccountRequestsPage />
              </RequireRole>
            }
          />
          {/* OPS-NFR-004 — chỉ Admin */}
          <Route
            path="system-status"
            element={
              <RequireRole allow={["ADMIN"]}>
                <AdminNodeStatusPage />
              </RequireRole>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="sales-home" element={<SalesHomePage />} />
        </Route>

        <Route path="*" element={<RoleHomeRedirect />} />
      </Routes>
    </Suspense>
  );
}
