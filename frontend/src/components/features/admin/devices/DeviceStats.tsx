import { CpuIcon, HourglassIcon, WarningIcon, WifiHighIcon, WifiSlashIcon } from '@phosphor-icons/react'
import { Card } from '@/components/ui'
import StatTile from '@/components/ui/StatTile'
import type { SystemNodeStatus } from '@/types'

/** Vòng icon xám như các ô trang Tổng quan/Người dùng/Nhật ký (theo ReadingTile Dashboard Farm Owner) */
const ICON = 'bg-warmGray/10 text-charcoal'

/**
 * Hàng 5 ô số đầu trang Thiết bị của Admin — cùng kiểu card "Chỉ số vận hành toàn hệ thống" (Tổng quan): bọc Card
 * + tiêu đề, ô bên trong bỏ shadow riêng, icon xám. Đếm từ `summary` của GET /devices/system-status (OPS-NFR-004),
 * toàn hệ thống, không theo bộ lọc bảng. Lỗi + Suy giảm gộp 1 ô "Cần xử lý" — ô đỏ khi có (giống ô Thiết bị ở
 * Tổng quan), vì đây là thiết bị cần Technician đến xem. Dòng phụ mỗi ô vừa 1 dòng, không dùng từ kỹ thuật
 * "heartbeat".
 */
export default function DeviceStats({ status }: { status: SystemNodeStatus }) {
  const { summary, nodes } = status
  const sensors = nodes.filter(n => n.type === 'sensor').length
  const faulty = summary.error + summary.degraded

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">Thống kê thiết bị</h2>
        <p className="mt-1 text-sm text-warmGray">Cảm biến và camera đang lắp trên mọi trang trại</p>
      </div>

      {/* 5 ô bằng nhau trên desktop; mobile: ô Tổng chiếm trọn hàng đầu, 4 ô còn lại xếp 2×2 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          className="col-span-2 shadow-none lg:col-span-1"
          icon={CpuIcon}
          iconClass={ICON}
          label="Tổng thiết bị"
          value={summary.total}
          sub={`${sensors} cảm biến · ${nodes.length - sensors} camera`}
        />
        <StatTile
          className="shadow-none"
          icon={WifiHighIcon}
          iconClass={ICON}
          label="Online"
          value={summary.online}
          sub={summary.total === 0 ? 'Chưa có thiết bị' : summary.online === summary.total ? 'Tất cả đang hoạt động' : 'Đang gửi dữ liệu bình thường'}
        />
        <StatTile
          className="shadow-none"
          icon={WifiSlashIcon}
          iconClass={ICON}
          label="Offline"
          value={summary.offline}
          // Flow 14: không nhận heartbeat > 30s → OFFLINE
          sub="Mất kết nối quá 30 giây"
        />
        <StatTile
          className="shadow-none"
          icon={WarningIcon}
          iconClass={ICON}
          label="Cần xử lý"
          value={faulty}
          sub={faulty > 0 ? `${summary.error} lỗi · ${summary.degraded} suy giảm` : 'Không có thiết bị lỗi'}
        />
        <StatTile
          className="shadow-none"
          icon={HourglassIcon}
          iconClass={ICON}
          label="Chờ kết nối"
          value={summary.pending}
          // PENDING: đã đăng ký/kích hoạt nhưng chưa từng gửi heartbeat (FARM-FR-003)
          sub="Đã lắp, chưa kết nối lần nào"
        />
      </div>
    </Card>
  )
}
