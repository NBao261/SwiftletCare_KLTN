import { Badge } from '@/components/ui'
import { type DataTableColumn } from '@/components/ui/DataTable'
import ActionsMenu, { type ActionsMenuItem } from '@/components/ui/ActionsMenu'
import { getUserStatus } from '@/hooks/admin/useUsers'
import { formatDate, formatDateOnly } from '@/lib/helpers'
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
    // Width theo % (bảng đang table-fixed) = độ dài nội dung thường gặp + 1 khoảng trống như nhau, để khe giữa
    // chữ cột này và cột sau đều nhau. Tổng = 100% (6+13+23+18+16+16+8), vẫn đủ chỗ ở min-w 960px.
    // Không thêm padding trái riêng cho cột nào (từng có `pl-12` ở Trạng thái làm badge lệch khỏi mép cột).
    // Mỗi ô 1 dòng (tên và email tách 2 cột): vùng phụ trách / lý do khoá xem ở modal chi tiết.
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[6%]',
      render: (_user, index) => <span className="text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      // Sort theo tên/email đặt ở nút "Sắp xếp" cùng hàng filter (không phải click header), như trước khi tách cột
      key: 'full_name', header: 'Họ tên', className: 'w-[13%]',
      render: (user) => <p className="truncate font-semibold text-charcoal" title={user.full_name}>{user.full_name}</p>,
    },
    {
      key: 'email', header: 'Email', className: 'w-[23%]',
      render: (user) => <p className="truncate text-graphite" title={user.email}>{user.email}</p>,
    },
    {
      key: 'role', header: 'Vai trò', sortable: true, className: 'w-[18%]',
      render: (user) => <Badge tone="info" className="whitespace-nowrap">{ROLE_LABEL[user.role]}</Badge>,
    },
    {
      key: 'status', header: 'Trạng thái', sortable: true, className: 'w-[16%]',
      render: (user) => {
        const status = getUserStatus(user)
        return <Badge tone={STATUS_TONE[status]} className="whitespace-nowrap">{STATUS_LABEL[status]}</Badge>
      },
    },
    {
      // Sort ngày tạo cũng đặt ở nút "Sắp xếp" cùng hàng filter, xem full_name ở trên.
      // Chỉ ngày (không giờ:phút:giây) — rê chuột xem đủ giờ tạo
      key: 'created_at', header: 'Ngày tạo', className: 'w-[16%] whitespace-nowrap',
      render: (user) => user.created_at
        ? <span className="text-graphite" title={formatDate(user.created_at)}>{formatDateOnly(user.created_at)}</span>
        : <span className="text-warmGray">—</span>,
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[8%]',
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
        return (
          // stopPropagation — dòng đã bấm-được (onRowClick mở chi tiết), mở menu bằng chuột/bàn phím không được kéo theo
          <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <ActionsMenu items={items} />
          </div>
        )
      },
    },
  ]
}
