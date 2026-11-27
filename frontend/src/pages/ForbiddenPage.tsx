import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import EmptyState from "@/components/ui/EmptyState";
import { useAuthStore } from "@/stores/authStore";
import { getRoleHomePath } from "@/constants/roles";
import { useDocumentTitle } from '@/hooks/common/useDocumentTitle'
import { t } from '@/i18n'

// Trang 403: hiển thị khi RequireRole chặn 1 route vì user không đủ quyền.
export default function ForbiddenPage() {
  useDocumentTitle(t('Không có quyền truy cập'))
  // Về trang nhà của role, không cứng "/dashboard" (role khác sẽ lại bị /403)
  const role = useAuthStore((s) => s.user?.role);
  const homePath = getRoleHomePath(role);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md">
        <EmptyState
          title="Bạn không có quyền truy cập trang này"
          description="Tài khoản của bạn không có vai trò phù hợp để xem nội dung này. Nếu đây là nhầm lẫn, hãy liên hệ chủ nhà yến hoặc quản trị viên."
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
