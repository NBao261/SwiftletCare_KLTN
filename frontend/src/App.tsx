import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import AdminLayout from "@/components/layouts/AdminLayout";
import FarmOwnerLayout from "@/components/layouts/FarmOwnerLayout";
import TechnicianLayout from "@/components/layouts/TechnicianLayout";
import SalesStaffLayout from "@/components/layouts/SalesStaffLayout";
import AppShell from "@/components/layouts/AppShell";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { setNavigate } from "@/lib/navigation";
import { getRoleHomePath } from "@/constants/roles";
import { publicRoutes } from "@/routes/public.routes";
import { farmOwnerRoutes } from "@/routes/farm-owner.routes";
import { technicianRoutes } from "@/routes/technician.routes";
import { adminRoutes } from "@/routes/admin.routes";
import { salesStaffRoutes } from "@/routes/sales-staff.routes";

/** Cài đặt tài khoản — route duy nhất mọi role đã đăng nhập đều dùng, nên nằm ngay đây thay vì trong một file route theo role. */
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

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

/**
 * Khung ứng dụng theo role người đang đăng nhập. Khác các dự án gắn layout theo
 * nhánh route (`/admin/*`): URL của SwiftletCare không có tiền tố role
 * (`/devices` dùng chung cho 3 role) nên phải chọn lúc chạy.
 */
function RoleLayout() {
  const role = useAuthStore((s) => s.user?.role);

  switch (role) {
    case "ADMIN":
      return <AdminLayout />;
    case "TECHNICIAN":
      return <TechnicianLayout />;
    case "SALES_STAFF":
      return <SalesStaffLayout />;
    case "FARM_OWNER":
      return <FarmOwnerLayout />;
    // Role lạ từ token cũ: vẫn dựng khung để Outlet render được, chỉ là chưa có
    // menu — giống hành vi cũ khi lọc nav bằng role không khớp.
    default:
      return <AppShell menuSections={[]} dockItems={[]} />;
  }
}

/** Đăng ký navigate() của router vào bridge để lib/axios.ts (ngoài React tree) dùng được. */
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

/**
 * Bảng route gốc. Chi tiết nằm trong `routes/<role>.routes.tsx`, một file cho
 * mỗi thư mục `pages/<role>/`: file đó tự lazy-load trang của mình
 * (code-splitting theo route) và tự khai `RequireRole`. Thư mục chứa trang cho
 * biết role SỞ HỮU nghiệp vụ đó, còn `allow={...}` trong file route mới là
 * danh sách role thật sự vào được — VD trang trong `pages/technician/` vẫn mở
 * cho Farm Owner và Admin qua `allow={OPS_ROLES}`.
 */
export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <NavigationBridge />
      <Routes>
        {publicRoutes}

        {/* Đã đăng nhập — bọc trong khung sidebar/topbar */}
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
          {farmOwnerRoutes}
          {technicianRoutes}
          {adminRoutes}
          {salesStaffRoutes}
        </Route>

        <Route path="*" element={<RoleHomeRedirect />} />
      </Routes>
    </Suspense>
  );
}
