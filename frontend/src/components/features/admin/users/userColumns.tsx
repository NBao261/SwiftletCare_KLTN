import { Badge } from '@/components/ui'
import { type DataTableColumn } from '@/components/ui/DataTable'
import ActionsMenu, { type ActionsMenuItem } from '@/components/ui/ActionsMenu'
import { getUserStatus } from '@/hooks/admin/useUsers'
import { formatDate } from '@/lib/helpers'
import { STATUS_LABEL, STATUS_TONE, ROLE_LABEL } from '@/components/features/admin/users/users.constants'
import type { User } from '@/types'

export interface UserColumnHandlers {
  onView: (user: User) => void
  /** Chỉ Technician — backend chỉ có PUT /admin/technicians/:id/regions, không sửa được full_name/phone */
  onEditRegions: (user: User) => void
  onLock: (user: User) => void
  onUnlock: (user: User) => void
}

/**
 * Cấu hình cột bảng Người dùng — tách riêng khỏi AdminUsersPage.tsx để trang chính
 * chỉ lo state/layout. `startIndex` là (page-1)*limit — để STT tính liên tục
 * qua các trang thay vì luôn bắt đầu lại từ 1 ở mỗi trang. `currentUserId` là
 * Admin đang đăng nhập — không cho tự khoá chính mình (backend cũng chặn, nhưng
 * ẩn nút thì khỏi phải ăn lỗi mới biết).
 */
export function buildUserColumns(handlers: UserColumnHandlers, startIndex: number, currentUserId?: string): DataTableColumn<User>[] {
  return [
    // Width theo % (bảng đang table-fixed) — mọi cột co giãn cùng tỉ lệ ở mọi độ
    // rộng màn hình, thay vì để cột "Người dùng" nuốt hết phần dư làm các cột
    // còn lại bị đẩy xa nhau. Tổng = 100%, vẫn đủ chỗ ở min-w 960px.
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[7%]',
      render: (_user, index) => <span className="text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      // Sort theo tên/email đặt ở nút "Sắp xếp" cùng hàng filter (không phải
      // click header) vì cột này gộp 2 trường — click 1 header không đủ diễn đạt
      // "sort theo tên" hay "sort theo email".
      key: 'full_name', header: 'Người dùng', className: 'w-[26%]',
      render: (user) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate font-semibold text-charcoal">{user.full_name}</p>
          <p className="truncate text-xs text-warmGray">{user.email}</p>
        </div>
      ),
    },
    {
      key: 'role', header: 'Vai trò', sortable: true, className: 'w-[16%]',
      render: (user) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <Badge tone="info" className="whitespace-nowrap">{ROLE_LABEL[user.role]}</Badge>
          {/* Farm của Sales Staff nằm ở sales_assignments, /admin/users không trả về → chỉ hiện vùng của Technician */}
          {!!user.assigned_regions?.length && (
            <p className="max-w-full truncate text-xs text-warmGray">{user.assigned_regions.join(', ')}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status', header: 'Trạng thái', sortable: true, className: 'w-[22%] pl-12',
      render: (user) => {
        const status = getUserStatus(user)
        return (
          <div className="flex min-w-0 flex-col items-start gap-0.5">
            <Badge tone={STATUS_TONE[status]} className="whitespace-nowrap">{STATUS_LABEL[status]}</Badge>
            {status === 'LOCKED' && user.deactivated_reason && (
              // truncate 1 dòng (không line-clamp 2 dòng) để mọi row cao bằng nhau,
              // nội dung đầy đủ xem ở tooltip title / modal chi tiết.
              <p className="max-w-full truncate text-xs text-red-600" title={user.deactivated_reason}>
                {user.deactivated_reason}
              </p>
            )}
          </div>
        )
      },
    },
    {
      // Sort ngày tạo cũng đặt ở nút "Sắp xếp" cùng hàng filter, xem full_name ở trên.
      key: 'created_at', header: 'Ngày tạo', className: 'w-[19%] whitespace-nowrap',
      render: (user) => <span className="text-warmGray">{user.created_at ? formatDate(user.created_at) : '—'}</span>,
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[10%]',
      render: (user) => {
        const status = getUserStatus(user)
        const items: ActionsMenuItem[] = [{ label: 'Xem chi tiết', onClick: () => handlers.onView(user) }]
        if (user.role === 'TECHNICIAN') {
          items.push({ label: 'Sửa vùng phụ trách', onClick: () => handlers.onEditRegions(user) })
        }
        // Đã xoá theo yêu cầu thì backend từ chối khoá/mở khoá (409) — không hiện nút
        const isSelf = user._id === currentUserId
        if (status === 'LOCKED') {
          items.push({ label: 'Mở khoá', onClick: () => handlers.onUnlock(user) })
        } else if (status !== 'DELETED' && !isSelf) {
          items.push({ label: 'Khoá tài khoản', danger: true, onClick: () => handlers.onLock(user) })
        }
        return <ActionsMenu items={items} />
      },
    },
  ]
}
