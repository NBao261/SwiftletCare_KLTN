import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState'

/** Trang 403 — hiển thị khi RequireRole chặn 1 route vì user không đủ quyền. */
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md">
        <EmptyState
          title="Bạn không có quyền truy cập trang này"
          description="Tài khoản của bạn không có vai trò phù hợp để xem nội dung này. Nếu đây là nhầm lẫn, hãy liên hệ chủ trang trại hoặc quản trị viên."
          action={
            <Link to="/dashboard">
              <Button variant="secondary">Về Trang tổng quan</Button>
            </Link>
          }
        />
      </div>
    </div>
  )
}
