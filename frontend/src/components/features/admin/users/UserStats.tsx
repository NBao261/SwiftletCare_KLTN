import { HouseIcon, LockIcon, StorefrontIcon, UsersIcon, WarningCircleIcon, WrenchIcon } from '@phosphor-icons/react'
import { getUserStatus, useAllUsers } from '@/hooks/admin/useUsers'
import { Button, Card, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import StatTile from '@/components/ui/StatTile'
import { ROLE_LABEL } from '@/constants/roles'
import { t } from '@/i18n'
import type { Role, User } from '@/types'

/** Vòng icon xám như các ô trang Tổng quan (theo ReadingTile Dashboard Farm Owner) */
const ICON = 'bg-warmGray/10 text-charcoal'

const ROLES_IN_TILES: Role[] = ['FARM_OWNER', 'TECHNICIAN', 'SALES_STAFF', 'ADMIN']

/** Dòng phụ ô vai trò: tình trạng hoạt động của nhóm đó (thay cho "% tổng số" — tỉ lệ không giúp Admin làm gì) */
function roleSub(list: User[]) {
  if (list.length === 0) return 'Chưa có tài khoản nào'
  const locked = list.filter(u => getUserStatus(u) === 'LOCKED').length
  return locked > 0 ? t('{{active}} hoạt động · {{locked}} đã khoá', { active: list.length - locked, locked }) : 'Tất cả đang hoạt động'
}

/**
 * Hàng 5 ô chỉ số đầu trang Người dùng — cùng khuôn hàng KPI trang Ticket (StatTile). Số liệu TOÀN HỆ
 * THỐNG (không theo bộ lọc bảng), đếm ở client từ useAllUsers() vì backend không có endpoint thống kê
 * tài khoản. Chỉ để xem — lọc theo vai trò/trạng thái dùng thanh công cụ của bảng.
 * - Tổng: kèm số Quản trị viên (không có ô riêng) để cộng các ô vai trò khớp tổng, + số chờ xoá nếu có.
 * - Kỹ thuật viên: dòng phụ đếm người CHƯA gán khu vực — Ticket Router không gán ticket được cho họ
 *   (TICKET-FR-004), là việc Admin cần làm (AUTH-FR-005c).
 * - Đã khoá: bị khoá thuộc vai trò nào.
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
  const noRegion = technicians.filter(u => !u.assigned_regions?.length).length
  const pendingDeletion = statusCount('PENDING_DELETION')
  const lockedUsers = users.filter(u => getUserStatus(u) === 'LOCKED')
  const lockedByRole = ROLES_IN_TILES
    .map(r => [r, lockedUsers.filter(u => u.role === r).length] as const)
    .filter(([, n]) => n > 0)
    .map(([r, n]) => `${n} ${ROLE_LABEL[r].toLowerCase()}`)
  const totalSub = [
    t('{{n}} hoạt động', { n: statusCount('ACTIVE') }),
    t('{{n}} quản trị viên', { n: byRole('ADMIN').length }),
    pendingDeletion > 0 && t('{{n}} chờ xoá', { n: pendingDeletion }),
  ].filter(Boolean).join(' · ')

  return (
    // Cùng kiểu card "Chỉ số vận hành toàn hệ thống" (trang Tổng quan): bọc Card + tiêu đề, ô bên trong bỏ shadow
    // riêng, icon xám đồng nhất
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">{t('Thống kê tài khoản')}</h2>
        <p className="mt-1 text-sm text-warmGray">{t('Số tài khoản theo vai trò và trạng thái trên toàn hệ thống')}</p>
      </div>

      {/* 5 ô bằng nhau trên desktop; mobile: ô Tổng chiếm trọn hàng đầu, 4 ô còn lại xếp 2×2 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          className="col-span-2 shadow-none lg:col-span-1"
          icon={UsersIcon}
          iconClass={ICON}
          label="Tổng tài khoản"
          value={total}
          sub={totalSub}
        />
        <StatTile className="shadow-none" icon={HouseIcon} iconClass={ICON} label="Chủ nhà yến" value={byRole('FARM_OWNER').length} sub={roleSub(byRole('FARM_OWNER'))} />
        <StatTile
          className="shadow-none"
          icon={WrenchIcon}
          iconClass={ICON}
          label="Kỹ thuật viên"
          value={technicians.length}
          // Có kỹ thuật viên chưa gán khu vực → ô nổi cam: Ticket Router không giao ticket cho họ được, việc của Admin
          tone={noRegion > 0 ? 'warning' : undefined}
          sub={technicians.length === 0 ? 'Chưa có tài khoản nào' : noRegion > 0 ? t('{{n}} chưa gán khu vực', { n: noRegion }) : 'Tất cả đã gán khu vực'}
        />
        <StatTile className="shadow-none" icon={StorefrontIcon} iconClass={ICON} label={ROLE_LABEL.SALES_STAFF} value={byRole('SALES_STAFF').length} sub={roleSub(byRole('SALES_STAFF'))} />
        <StatTile
          className="shadow-none"
          icon={LockIcon}
          iconClass={ICON}
          label="Đã khoá"
          value={lockedUsers.length}
          sub={lockedByRole.length ? lockedByRole.join(' · ') : 'Không có tài khoản bị khoá'}
        />
      </div>
    </Card>
  )
}
