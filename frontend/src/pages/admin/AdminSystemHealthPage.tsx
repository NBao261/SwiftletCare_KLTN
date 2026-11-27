// Tổng quan hệ thống: 4 ô chỉ số chỉ để xem, thiết bị cần chú ý và nhật ký gần đây
import { CpuIcon, HouseIcon, UsersIcon, WarningIcon } from '@phosphor-icons/react'
import { useSystemHealth } from '@/hooks/admin/useSystem'
import { useAlertsList } from '@/hooks/shared/useAlerts'
import KpiTile from '@/components/common/KpiTile'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import AttentionDevicesCard from '@/components/features/admin/dashboard/AttentionDevicesCard'
import RecentActivityCard from '@/components/features/admin/dashboard/RecentActivityCard'
import { getApiErrorMessage } from '@/lib/helpers'
import { t as i18nT } from '@/i18n'

// Màu vòng icon theo ReadingTile (Dashboard Farm Owner): xám nhạt, không đổi đỏ theo trạng thái
const ICON_NORMAL = 'bg-warmGray/10 text-charcoal'

export default function AdminSystemHealthPage() {
  const { data, isLoading, error } = useSystemHealth()
  // Quản trị viên chỉ thấy cảnh báo thiết bị; chỉ đếm, không mở từng cảnh báo
  const openAlerts = useAlertsList({ status: 'ACTIVE', page: 1, limit: 1 })
  const criticalAlerts = useAlertsList({ status: 'ACTIVE', severity: 'CRITICAL', page: 1, limit: 1 })

  if (isLoading) return <LoadingSkeleton count={4} className="h-28 w-full" />
  if (error || !data) {
    return (
      <EmptyState
        icon={<WarningIcon size={28} />}
        title="Không tải được số liệu hệ thống"
        description={getApiErrorMessage(error, 'Thử tải lại trang.')}
      />
    )
  }

  const { farms, zones, devices, users } = data
  const hasDevices = devices.total > 0
  // Liệt kê mọi trạng thái khác ONLINE đang có (bỏ số 0)
  const deviceIssues = ([
    [devices.offline, 'mất kết nối'],
    [devices.pending, 'chờ kết nối'],
  ] as const).filter(([n]) => n > 0).map(([n, label]) => `${n} ${i18nT(label)}`)
  const deviceSub = !hasDevices
    ? 'Chưa có thiết bị'
    : deviceIssues.length ? deviceIssues.join(' · ') : 'Tất cả đang online'
  const alertSub = openAlerts.total === 0
    ? 'Không có cảnh báo đang mở'
    : criticalAlerts.total > 0 ? i18nT('{{n}} khẩn cấp', { n: criticalAlerts.total }) : 'Không có cảnh báo khẩn cấp'

  // Cả 4 ô chỉ để xem, không ô nào bấm được; muốn xem tiếp thì dùng "Xem tất cả" của hai thẻ bên dưới hoặc menu
  const tiles = [
    {
      key: 'devices', icon: CpuIcon, label: 'Thiết bị online',
      // Số thiết bị online / tổng thiết bị đang phục vụ (thay cho %: 0% với 2 thiết bị khó hình dung)
      value: hasDevices ? `${devices.online}/${devices.total}` : '--', sub: deviceSub, warn: devices.offline > 0,
    },
    { key: 'alerts', icon: WarningIcon, label: 'Cảnh báo đang mở', value: String(openAlerts.total), sub: alertSub, warn: criticalAlerts.total > 0 },
    { key: 'farms', icon: HouseIcon, label: 'Trang trại hoạt động', value: farms.total, sub: i18nT('Gồm {{n}} Zone', { n: zones.total }), warn: false },
    // tài khoản đăng nhập được (gồm chờ xoá) và bị khoá; chi tiết theo role ở trang Người dùng
    { key: 'users', icon: UsersIcon, label: 'Tài khoản hoạt động', value: users.active, sub: i18nT('{{n}} bị khoá', { n: users.inactive }), warn: false },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(tile => (
          <KpiTile
            key={tile.key}
            className="h-full"
            icon={tile.icon}
            iconClass={ICON_NORMAL}
            tone={tile.warn ? 'warning' : undefined}
            label={tile.label}
            value={tile.value}
            sub={tile.sub}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <AttentionDevicesCard />
        <RecentActivityCard />
      </div>
    </div>
  )
}
