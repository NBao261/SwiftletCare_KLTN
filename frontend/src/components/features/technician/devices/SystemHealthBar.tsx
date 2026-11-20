import { CpuIcon, HourglassIcon, WarningIcon, WifiHighIcon, WifiSlashIcon } from '@phosphor-icons/react'
import KpiTile from '@/components/common/KpiTile'
import type { SensorNode } from '@/types'

/** Node cần Technician xử lý: quá hạn kích hoạt / OTA lỗi (ERROR/DEGRADED đã bỏ SRS 3.1.0) */
export const needsAttention = (n: SensorNode) =>
  !!n.activation_overdue_at || !!n.ota_failed

// Hàng KPI đầu trang Thiết bị theo phạm vi đang chọn; "Cần xử lý" là quá hạn kích hoạt hoặc cập nhật firmware lỗi
export default function SystemHealthBar({ nodes = [] }: { nodes?: SensorNode[] }) {
  const total = nodes.length
  const online = nodes.filter(n => n.status === 'ONLINE').length
  const offline = nodes.filter(n => n.status === 'OFFLINE').length
  const pending = nodes.filter(n => n.status === 'PENDING').length
  const attention = nodes.filter(needsAttention).length
  const pct = total > 0 ? Math.round((online / total) * 100) : 0

  return (
    <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-5">
      <KpiTile
        className="col-span-2 lg:col-span-1"
        icon={CpuIcon}
        iconClass="bg-warmGray/10 text-charcoal"
        label="Tổng thiết bị"
        value={total}
        sub="Trong phạm vi đang chọn"
      />
      <KpiTile icon={WifiHighIcon} iconClass="bg-warmGray/10 text-success" label="Online" value={online} sub={`${pct}% tổng số`} />
      <KpiTile
        icon={WifiSlashIcon}
        iconClass={offline > 0 ? 'bg-warmGray/10 text-orange-600' : 'bg-warmGray/10 text-charcoal'}
        label="Mất kết nối"
        value={offline}
        sub="Không còn gửi tín hiệu"
      />
      <KpiTile
        icon={WarningIcon}
        iconClass={attention > 0 ? 'bg-warmGray/10 text-alertRed' : 'bg-warmGray/10 text-charcoal'}
        alert={attention > 0}
        label="Cần xử lý"
        value={attention}
        sub="Quá hạn kích hoạt hoặc cập nhật lỗi"
      />
      <KpiTile
        icon={HourglassIcon}
        iconClass="bg-warmGray/10 text-charcoal"
        label="Chờ kết nối"
        value={pending}
        sub="Đã kích hoạt, chưa gửi tín hiệu"
      />
    </div>
  )
}
