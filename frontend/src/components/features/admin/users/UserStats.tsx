import { HouseIcon, LockIcon, StorefrontIcon, UsersThreeIcon, WarningCircleIcon, WrenchIcon } from '@phosphor-icons/react'
import { getUserStatus, useAllUsers } from '@/hooks/admin/useUsers'
import { Button, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import StatTile from '@/components/ui/StatTile'
import type { Role } from '@/types'

const pct = (n: number, total: number) => `${total > 0 ? Math.round((n / total) * 100) : 0}% tổng số`

/**
 * Hàng 5 ô chỉ số đầu trang Người dùng — cùng khuôn hàng KPI trang Ticket (StatTile). Số liệu TOÀN HỆ
 * THỐNG (không theo bộ lọc bảng), đếm ở client từ useAllUsers() vì backend không có endpoint thống kê
 * tài khoản. Chỉ để xem — lọc theo vai trò/trạng thái dùng thanh công cụ của bảng.
 * - Kỹ thuật viên: dòng phụ đếm người CHƯA gán khu vực — Ticket Router không gán ticket được cho họ
 *   (TICKET-FR-004), là việc Admin cần làm (AUTH-FR-005c).
 * - Đã khoá: kèm số tài khoản đang chờ xoá (xử lý ở trang Yêu cầu tài khoản).
 */
export default function UserStats() {
  const { data: users, isLoading, isError, refetch } = useAllUsers()

  if (isLoading) return <LoadingSkeleton count={1} className="h-28 w-full" />
  if (isError || !users) {
    return (
      <EmptyState
        icon={<WarningCircleIcon size={32} />}
        title="Không tải được thống kê tài khoản"
        description="Kiểm tra kết nối tới máy chủ rồi thử lại."
        action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Thử lại</Button>}
      />
    )
  }

  const total = users.length
  const byRole = (r: Role) => users.filter(u => u.role === r)
  const statusCount = (s: ReturnType<typeof getUserStatus>) => users.filter(u => getUserStatus(u) === s).length
  const technicians = byRole('TECHNICIAN')
  const noRegion = technicians.filter(t => !t.assigned_regions?.length).length
  const pendingDeletion = statusCount('PENDING_DELETION')

  return (
    // 5 ô bằng nhau trên desktop; mobile: ô Tổng chiếm trọn hàng đầu, 4 ô còn lại xếp 2×2 — như trang Ticket
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatTile
        className="col-span-2 lg:col-span-1"
        icon={UsersThreeIcon}
        iconClass="bg-charcoal text-limeMist"
        label="Tổng tài khoản"
        value={total}
        sub={`${statusCount('ACTIVE')} hoạt động · ${statusCount('LOCKED')} đã khoá`}
      />
      <StatTile icon={HouseIcon} iconClass="bg-accent-300 text-charcoal" label="Chủ nhà yến" value={byRole('FARM_OWNER').length} sub={pct(byRole('FARM_OWNER').length, total)} />
      <StatTile
        icon={WrenchIcon}
        iconClass="bg-accent-300 text-charcoal"
        label="Kỹ thuật viên"
        value={technicians.length}
        sub={noRegion > 0 ? `${noRegion} chưa gán khu vực` : 'Đều đã gán khu vực'}
      />
      <StatTile icon={StorefrontIcon} iconClass="bg-warmGray/10 text-charcoal" label="Nhân viên kinh doanh" value={byRole('SALES_STAFF').length} sub={pct(byRole('SALES_STAFF').length, total)} />
      <StatTile
        icon={LockIcon}
        iconClass="bg-red-100 text-red-600"
        label="Đã khoá"
        value={statusCount('LOCKED')}
        sub={pendingDeletion > 0 ? `${pendingDeletion} tài khoản chờ xoá` : 'Không có yêu cầu xoá'}
      />
    </div>
  )
}
