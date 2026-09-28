import { CpuIcon, HourglassIcon, WarningIcon, WifiHighIcon, WifiSlashIcon } from '@phosphor-icons/react'
import StatTile from '@/components/ui/StatTile'
import type { SystemNodeStatus } from '@/types'

const pct = (n: number, total: number) => `${total > 0 ? Math.round((n / total) * 100) : 0}% tổng số`

/**
 * Hàng 5 ô số đầu trang Thiết bị của Admin — cùng khuôn hàng KPI trang Ticket/Người dùng (StatTile). Đếm từ
 * `summary` của GET /devices/system-status (OPS-NFR-004), toàn hệ thống, không theo bộ lọc bảng.
 * Lỗi + Suy giảm gộp 1 ô "Cần xử lý" — cả ô đỏ khi có, vì đây là thiết bị cần Technician đến xem.
 */
export default function DeviceStats({ status }: { status: SystemNodeStatus }) {
  const { summary, nodes } = status
  const sensors = nodes.filter(n => n.type === 'sensor').length
  const faulty = summary.error + summary.degraded

  return (
    // 5 ô bằng nhau trên desktop; mobile: ô Tổng chiếm trọn hàng đầu, 4 ô còn lại xếp 2×2 — như trang Ticket
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatTile
        className="col-span-2 lg:col-span-1"
        icon={CpuIcon}
        iconClass="bg-charcoal text-limeMist"
        label="Tổng thiết bị"
        value={summary.total}
        sub={`${sensors} cảm biến · ${nodes.length - sensors} camera`}
      />
      <StatTile icon={WifiHighIcon} iconClass="bg-accent-300 text-charcoal" label="Online" value={summary.online} sub={pct(summary.online, summary.total)} />
      <StatTile
        icon={WifiSlashIcon}
        iconClass={summary.offline > 0 ? 'bg-orange-100 text-orange-600' : 'bg-warmGray/10 text-charcoal'}
        label="Offline"
        value={summary.offline}
        sub="Mất heartbeat quá 30 giây"
      />
      <StatTile
        icon={WarningIcon}
        iconClass={faulty > 0 ? 'bg-alertRed text-white' : 'bg-warmGray/10 text-charcoal'}
        alert={faulty > 0}
        label="Cần xử lý"
        value={faulty}
        sub={`${summary.error} lỗi · ${summary.degraded} suy giảm`}
      />
      <StatTile
        icon={HourglassIcon}
        iconClass="bg-warmGray/10 text-charcoal"
        label="Chờ kết nối"
        value={summary.pending}
        sub="Đã kích hoạt, chưa gửi heartbeat"
      />
    </div>
  )
}
