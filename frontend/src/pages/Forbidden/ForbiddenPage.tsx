import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import EmptyState from "@/components/common/EmptyState";
import { useAuthStore } from "@/store/authStore";
import { getRoleHomePath } from "@/components/layout/navItems";

/** Trang 403 — hiển thị khi RequireRole chặn 1 route vì user không đủ quyền. */
export default function ForbiddenPage() {
  // "/dashboard" cứng ở đây từng khiến Technician/Admin/Sales Staff bấm "Về
  // Trang tổng quan" bị đá thẳng trở lại /403 (họ không có quyền vào Dashboard)
  // — giờ về đúng trang nhà của role đó.
  const role = useAuthStore((s) => s.user?.role);
  const homePath = getRoleHomePath(role);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md">
        <EmptyState
          title="Bạn không có quyền truy cập trang này"
          description="Tài khoản của bạn không có vai trò phù hợp để xem nội dung này. Nếu đây là nhầm lẫn, hãy liên hệ chủ trang trại hoặc quản trị viên."
          action={
            <Link to={homePath}>
              <Button variant="secondary">Về trang chính</Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}
