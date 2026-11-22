import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import AdminLayout from "@/components/layouts/AdminLayout";
import FarmOwnerLayout from "@/components/layouts/FarmOwnerLayout";
import TechnicianLayout from "@/components/layouts/TechnicianLayout";
import DomainExpertLayout from "@/components/layouts/DomainExpertLayout";
import AppShell from "@/components/layouts/AppShell";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { setNavigate } from "@/lib/navigation";
import { getRoleHomePath } from "@/constants/roles";
import { publicRoutes } from "@/routes/public.routes";
import LoginSplash from "@/components/auth/LoginSplash";
import { farmOwnerRoutes } from "@/routes/farm-owner.routes";
import { technicianRoutes } from "@/routes/technician.routes";
import { adminRoutes } from "@/routes/admin.routes";
import { domainExpertRoutes } from "@/routes/domain-expert.routes";

// Mọi role đã đăng nhập đều dùng nên khai ở đây
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const SettingsPrivacyPage = lazy(() => import("@/pages/SettingsPrivacyPage"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const mustChangePassword = useAuthStore((s) => s.user?.must_change_password === true);
  const location = useLocation();

  // Chờ zustand/persist đọc xong: tránh nháy về /login khi F5
  if (!hasHydrated) return <RouteFallback />;

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  // còn mật khẩu tạm thì chỉ vào được trang đổi mật khẩu
  if (mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

// URL không có tiền tố role (`/devices` dùng chung) nên chọn khung lúc chạy
function RoleLayout() {
  const role = useAuthStore((s) => s.user?.role);

  switch (role) {
    case "ADMIN":
      return <AdminLayout />;
    case "FARM_TECHNICIAN":
      return <TechnicianLayout />;
    case "DOMAIN_EXPERT":
      return <DomainExpertLayout />;
    case "FARM_OWNER":
      return <FarmOwnerLayout />;
    // Role lạ từ token cũ: vẫn dựng khung để Outlet render, chỉ chưa có menu
    default:
      return <AppShell menuSections={[]} dockItems={[]} />;
  }
}

// Đăng ký navigate() của router vào bridge để lib/axios.ts (ngoài React tree) dùng được.
function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigate(navigate);
    return () => setNavigate(null);
  }, [navigate]);
  return null;
}

// Trang mặc định sau khi vào "/" hoặc gõ URL không tồn tại: tuỳ role vì mỗi role có bộ trang riêng.
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

// Route chi tiết ở `routes/<role>.routes.tsx`; `allow={...}` mới là danh sách role vào được
export default function App() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <NavigationBridge />
        <Routes>
          {publicRoutes}

          {/* Đã đăng nhập: bọc trong khung sidebar/topbar */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleHomeRedirect />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/privacy" element={<SettingsPrivacyPage />} />
            {farmOwnerRoutes}
            {technicianRoutes}
            {adminRoutes}
            {domainExpertRoutes}
          </Route>

          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </Suspense>
      {/* Màn chuyển cảnh sau đăng nhập: ngoài Suspense để không bị thay bằng màn chờ khi trang trong đang tải */}
      <LoginSplash />
    </>
  );
}
