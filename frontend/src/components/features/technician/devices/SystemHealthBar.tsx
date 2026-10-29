import { CpuIcon, HourglassIcon, WarningIcon, WifiHighIcon, WifiSlashIcon } from '@phosphor-icons/react'
import StatTile from '@/components/ui/StatTile'
import type { SensorNode } from '@/types'

/** Node cần Technician xử lý: quá hạn kích hoạt / OTA lỗi (ERROR/DEGRADED đã bỏ SRS 3.1.0) */
export const needsAttention = (n: SensorNode) =>
  !!n.activation_overdue_at || !!n.ota_failed

/**
 * Hàng KPI đầu trang Thiết bị — cùng StatTile với Admin/Farm Owner. Đếm theo node của zone đang chọn.
 * "Cần xử lý" gộp lỗi + suy giảm + quá hạn kích hoạt + OTA lỗi (không gộp "Chờ kết nối" bình thường).
 */
export default function SystemHealthBar({ nodes = [] }: { nodes?: SensorNode[] }) {
  const total = nodes.length
  const online = nodes.filter(n => n.status === 'ONLINE').length
  const offline = nodes.filter(n => n.status === 'OFFLINE').length
  const pending = nodes.filter(n => n.status === 'PENDING').length
  const attention = nodes.filter(needsAttention).length
  const pct = total > 0 ? Math.round((online / total) * 100) : 0

  return (
    <section className="w-full rounded-[24px] border border-warmGray/15 bg-white p-4 shadow-sm">
      <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
        className="col-span-2 lg:col-span-1"
        icon={CpuIcon}
        iconClass="bg-warmGray/10 text-charcoal"
        label="Tổng thiết bị"
        value={total}
        sub="Trong zone đang chọn"
      />
      <StatTile icon={WifiHighIcon} iconClass="bg-warmGray/10 text-success" label="Online" value={online} sub={`${pct}% tổng số`} />
      <StatTile
        icon={WifiSlashIcon}
        iconClass={offline > 0 ? 'bg-warmGray/10 text-orange-600' : 'bg-warmGray/10 text-charcoal'}
        label="Mất kết nối"
        value={offline}
        sub="Mất heartbeat"
      />
      <StatTile
        icon={WarningIcon}
        iconClass={attention > 0 ? 'bg-warmGray/10 text-alertRed' : 'bg-warmGray/10 text-charcoal'}
        alert={attention > 0}
        label="Cần xử lý"
        value={attention}
        sub="Lỗi · suy giảm · OTA lỗi · quá hạn"
      />
      <StatTile
        icon={HourglassIcon}
        iconClass="bg-warmGray/10 text-charcoal"
        label="Chờ kết nối"
        value={pending}
        sub="Đã kích hoạt, chưa có heartbeat"
      />
      </div>
    </section>
  )
}
