// Tổng quan hệ thống: 4 ô chỉ số bấm được tới trang liên quan, thiết bị cần chú ý và nhật ký gần đây
import { Link } from 'react-router-dom'
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

  // Ô có trang liên quan thì bấm được; số trang trại chỉ để biết quy mô
  const tiles = [
    {
      key: 'devices', to: '/devices', icon: CpuIcon, label: 'Thiết bị online',
      // Số thiết bị online / tổng thiết bị đang phục vụ (thay cho %: 0% với 2 thiết bị khó hình dung)
      value: hasDevices ? `${devices.online}/${devices.total}` : '--', sub: deviceSub, warn: devices.offline > 0,
    },
    { key: 'alerts', to: '/alerts', icon: WarningIcon, label: 'Cảnh báo đang mở', value: String(openAlerts.total), sub: alertSub, warn: criticalAlerts.total > 0 },
    { key: 'farms', to: undefined, icon: HouseIcon, label: 'Trang trại hoạt động', value: farms.total, sub: i18nT('Gồm {{n}} Zone', { n: zones.total }), warn: false },
    // tài khoản đăng nhập được (gồm chờ xoá) và bị khoá; chi tiết theo role ở trang Người dùng
    { key: 'users', to: '/users', icon: UsersIcon, label: 'Tài khoản hoạt động', value: users.active, sub: i18nT('{{n}} bị khoá', { n: users.inactive }), warn: false },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(tile => {
          const content = (
            <KpiTile
              className={tile.to ? 'h-full transition-shadow group-hover:shadow-md' : 'h-full'}
              icon={tile.icon}
              iconClass={ICON_NORMAL}
              tone={tile.warn ? 'warning' : undefined}
              label={tile.label}
              value={tile.value}
              sub={tile.sub}
            />
          )
          return tile.to
            ? <Link key={tile.key} to={tile.to} className="group block rounded-2xl">{content}</Link>
            : <div key={tile.key}>{content}</div>
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
        <AttentionDevicesCard />
        <RecentActivityCard />
      </div>
    </div>
  )
}
