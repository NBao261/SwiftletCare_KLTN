import type { BadgeTone } from '@/components/ui'
import type { UsersSortKey } from '@/hooks/useUsers'
import type { UserStatus } from '@/types'

export const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Hoạt động', LOCKED: 'Đã khoá', PENDING_DELETION: 'Chờ xoá', DELETED: 'Đã xoá',
}
export const STATUS_TONE: Record<UserStatus, BadgeTone> = {
  ACTIVE: 'positive', LOCKED: 'critical', PENDING_DELETION: 'warning', DELETED: 'neutral',
}
/**
 * Chip lọc trên trang — chỉ 2 giá trị map thẳng vào /admin/users?status=active|inactive.
 * PENDING_DELETION có trang riêng (Yêu cầu tài khoản, /admin/delete-requests) nên
 * không lọc ở đây; DELETED không có filter riêng ở backend (nằm trong inactive).
 * Cả 2 vẫn hiện dưới dạng badge trên từng dòng.
 */
export type FilterableStatus = Extract<UserStatus, 'ACTIVE' | 'LOCKED'>
export const FILTERABLE_STATUSES: FilterableStatus[] = ['ACTIVE', 'LOCKED']

/** Nhãn vai trò tiếng Việt dùng chung toàn app (Sidebar, Settings...) — re-export để các file trong thư mục này import 1 chỗ */
export { ROLE_LABEL } from '@/constants/roles'

/**
 * Cột "Người dùng" gộp tên+email nên không sort qua click header được (1 header
 * = 1 field) — mỗi field (tên/email/ngày tạo) có 1 nút sort riêng cùng hàng
 * filter, bấm để chọn field đó làm sort chính, bấm lại để đổi chiều asc/desc
 * (cùng cơ chế handleSortChange đang dùng cho click header Vai trò/Trạng thái).
 */
export const SORT_FIELDS: { key: UsersSortKey; label: string }[] = [
  { key: 'created_at', label: 'Ngày tạo' },
  { key: 'full_name', label: 'Tên' },
  { key: 'email', label: 'Email' },
]
