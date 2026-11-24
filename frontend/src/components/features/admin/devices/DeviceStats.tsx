import { CpuIcon, HourglassIcon, WifiHighIcon, WifiSlashIcon } from '@phosphor-icons/react'
import KpiTile from '@/components/common/KpiTile'
import { t } from '@/i18n'
import type { SystemNodeStatus } from '@/types'

// Vòng icon xám như các ô trang Tổng quan/Người dùng/Nhật ký (theo ReadingTile Dashboard Farm Owner)
const ICON = 'bg-warmGray/10 text-charcoal'

// 4 ô đầu trang Thiết bị của Admin, đếm từ `summary` của GET /devices/system-status
export default function DeviceStats({ status }: { status: SystemNodeStatus }) {
  const { summary, nodes } = status
  const sensors = nodes.filter(n => n.type === 'sensor').length

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiTile
        icon={CpuIcon}
        iconClass={ICON}
        label="Tổng thiết bị"
        value={summary.total}
        sub={t('{{sensors}} bộ điều khiển · {{cameras}} camera đếm chim', { sensors, cameras: nodes.length - sensors })}
      />
      <KpiTile
        icon={WifiHighIcon}
        iconClass={ICON}
        label="Online"
        value={summary.online}
        sub={summary.total === 0 ? 'Chưa có thiết bị' : summary.online === 0 ? 'Chưa có thiết bị online' : summary.online === summary.total ? 'Tất cả đang hoạt động' : 'Đang gửi dữ liệu'}
      />
      <KpiTile
        icon={WifiSlashIcon}
        iconClass={ICON}
        label="Mất kết nối"
        value={summary.offline}
        tone={summary.offline > 0 ? 'warning' : undefined}
        // không nhận heartbeat > 30s → OFFLINE
        sub={summary.offline > 0 ? 'Mất tín hiệu quá 30 giây' : 'Tất cả đều kết nối'}
      />
      <KpiTile
        icon={HourglassIcon}
        iconClass={ICON}
        label="Chờ kết nối"
        value={summary.pending}
        // PENDING: đã đăng ký/kích hoạt nhưng chưa từng gửi heartbeat
        sub={summary.pending > 0 ? 'Chưa kết nối lần nào' : 'Không có thiết bị chờ'}
      />
    </div>
  )
}
