import { GraduationCapIcon, HouseIcon, UsersIcon, WarningCircleIcon, WrenchIcon } from '@phosphor-icons/react'
import { getUserStatus, useAllUsers } from '@/hooks/admin/useUsers'
import { Button, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import KpiTile from '@/components/common/KpiTile'
import { ROLE_LABEL } from '@/constants/roles'
import { t } from '@/i18n'
import type { Role, User } from '@/types'

/** Vòng icon xám như các ô trang Tổng quan (theo ReadingTile Dashboard Farm Owner) */
const ICON = 'bg-warmGray/10 text-charcoal'

/** Dòng phụ ô vai trò: tình trạng hoạt động của nhóm đó (thay cho "% tổng số" — tỉ lệ không giúp Admin làm gì) */
function roleSub(list: User[]) {
  if (list.length === 0) return 'Chưa có tài khoản nào'
  const locked = list.filter(u => getUserStatus(u) === 'LOCKED').length
  return locked > 0 ? t('{{active}} hoạt động · {{locked}} đã khoá', { active: list.length - locked, locked }) : 'Tất cả đang hoạt động'
}

// AD-03 — 4 ô đầu trang Người dùng, đếm ở client từ useAllUsers() vì backend không có endpoint thống kê tài khoản
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

  const byRole = (r: Role) => users.filter(u => u.role === r)
  const locked = users.filter(u => getUserStatus(u) === 'LOCKED').length

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiTile icon={UsersIcon} iconClass={ICON} label="Tổng tài khoản" value={users.length} sub={t('{{n}} đã khoá', { n: locked })} />
      <KpiTile icon={HouseIcon} iconClass={ICON} label="Chủ nhà yến" value={byRole('FARM_OWNER').length} sub={roleSub(byRole('FARM_OWNER'))} />
      <KpiTile icon={WrenchIcon} iconClass={ICON} label="Kỹ thuật viên" value={byRole('FARM_TECHNICIAN').length} sub={roleSub(byRole('FARM_TECHNICIAN'))} />
      <KpiTile icon={GraduationCapIcon} iconClass={ICON} label={ROLE_LABEL.DOMAIN_EXPERT} value={byRole('DOMAIN_EXPERT').length} sub={roleSub(byRole('DOMAIN_EXPERT'))} />
    </div>
  )
}
