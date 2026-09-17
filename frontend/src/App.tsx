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
import type { Role } from "@/types";

// Code-splitting theo route — tránh bundle chính kéo theo chart.js/date-fns
// (chỉ AnalyticsPage dùng) cho mọi user kể cả khi họ chưa từng vào /analytics.
const LoginPage = lazy(() => import("@/pages/Auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/Auth/RegisterPage"));
const ForgotPasswordPage = lazy(
  () => import("@/pages/Auth/ForgotPasswordPage"),
);
const InvitationPage = lazy(() => import("@/pages/Invitations/InvitationPage"));
const DashboardPage = lazy(() => import("@/pages/Dashboard/DashboardPage"));
const FarmsPage = lazy(() => import("@/pages/Farms/FarmsPage"));
const DevicesPage = lazy(() => import("@/pages/Devices/DevicesPage"));
const AlertsPage = lazy(() => import("@/pages/Alerts/AlertsPage"));
const AnalyticsPage = lazy(() => import("@/pages/Analytics/AnalyticsPage"));
const LiveStreamPage = lazy(() => import("@/pages/LiveStream/LiveStreamPage"));
const SettingsPage = lazy(() => import("@/pages/Settings/SettingsPage"));
const TicketsPage = lazy(() => import("@/pages/Tickets/TicketsPage"));
const TicketDetailPage = lazy(() => import("@/pages/Tickets/TicketDetailPage"));
const HarvestPage = lazy(() => import("@/pages/Harvest/HarvestPage"));
const MarketplacePage = lazy(
  () => import("@/pages/Marketplace/MarketplacePage"),
);
const ListingDetailPage = lazy(
  () => import("@/pages/Marketplace/ListingDetailPage"),
);
const ForbiddenPage = lazy(() => import("@/pages/Forbidden/ForbiddenPage"));
const SalesHomePage = lazy(() => import("@/pages/SalesHome/SalesHomePage"));
const AdminNodeStatusPage = lazy(
  () => import("@/pages/AdminNodeStatus/AdminNodeStatusPage"),
);

// Route ứng với công việc vận hành farm — Sales Staff chưa có màn hình nghiệp vụ
// riêng (module Bán hàng thuộc Giai đoạn 2, xem SalesHomePage) nên không thuộc nhóm này.
const OPS_ROLES: Role[] = ["FARM_OWNER", "TECHNICIAN", "ADMIN"];
// Dashboard/Analytics (giám sát môi trường chi tiết theo zone) là công cụ vận
// hành hằng ngày CỦA RIÊNG Farm Owner — Technician/Admin xử lý kỹ thuật/ticket,
// không cần chi tiết tới mức đó (xem navItems.tsx).
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
  const home: Record<Role, string> = {
    FARM_OWNER: "/dashboard",
    ADMIN: "/system-status",
    TECHNICIAN: "/devices",
    SALES_STAFF: "/sales-home",
  };
  return <Navigate to={role ? home[role] : "/dashboard"} replace />;
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
