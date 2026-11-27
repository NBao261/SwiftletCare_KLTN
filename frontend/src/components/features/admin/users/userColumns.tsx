import { Badge } from '@/components/ui'
import { type DataTableColumn } from '@/components/ui/DataTable'
import ActionsMenu, { type ActionsMenuItem } from '@/components/ui/ActionsMenu'
import { getUserStatus } from '@/hooks/admin/useUsers'
import { formatDate } from '@/lib/helpers'
import { STATUS_LABEL, STATUS_TONE, ROLE_LABEL } from '@/components/features/admin/users/users.constants'
import type { User } from '@/types'

const DAY_FORMAT = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })

export interface UserColumnHandlers {
  onView: (user: User) => void
  onLock: (user: User) => void
  onUnlock: (user: User) => void
}

// Ẩn nút tự khoá chính mình (backend cũng chặn)
export function buildUserColumns(handlers: UserColumnHandlers, currentUserId?: string): DataTableColumn<User>[] {
  return [
    // Width % cho table-fixed, tổng 100
    {
      // Tên đậm, email xám bên dưới; dài thì cắt, rê chuột xem đủ
      key: 'full_name', header: 'Họ tên và email', sortable: true, className: 'w-[38%]',
      render: (user) => (
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-semibold text-charcoal" title={user.full_name}>{user.full_name}</p>
          <p className="truncate text-small text-warmGray" title={user.email}>{user.email}</p>
        </div>
      ),
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
      // Chỉ ngày; giờ tạo xem ở chi tiết
      key: 'created_at', header: 'Ngày tạo', sortable: true, className: 'w-[18%] whitespace-nowrap',
      render: (user) => user.created_at
        ? <span className="text-graphite" title={formatDate(user.created_at)}>{DAY_FORMAT.format(new Date(user.created_at))}</span>
        : <span className="text-warmGray">—</span>,
    },
    {
      key: 'actions', header: '', align: 'center', className: 'w-[10%]',
      render: (user) => {
        const status = getUserStatus(user)
        const items: ActionsMenuItem[] = [{ label: 'Xem chi tiết', onClick: () => handlers.onView(user) }]
        // Đã xoá theo yêu cầu thì backend từ chối khoá/mở khoá (409): không hiện nút
        const isSelf = user._id === currentUserId
        if (status === 'LOCKED') {
          items.push({ label: 'Mở khoá', onClick: () => handlers.onUnlock(user) })
        } else if (status !== 'DELETED' && !isSelf) {
          items.push({ label: 'Khoá tài khoản', danger: true, onClick: () => handlers.onLock(user) })
        }
        return (
          // stopPropagation: dòng đã bấm-được (onRowClick mở chi tiết), mở menu bằng chuột/bàn phím không được kéo theo
          <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <ActionsMenu items={items} />
          </div>
        )
      },
    },
  ]
}
