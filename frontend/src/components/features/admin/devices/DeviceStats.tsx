import { CpuIcon, HourglassIcon, WarningIcon, WifiHighIcon, WifiSlashIcon } from '@phosphor-icons/react'
import { Card } from '@/components/ui'
import StatTile from '@/components/ui/StatTile'
import { t } from '@/i18n'
import type { SystemNodeStatus } from '@/types'

/** Vòng icon xám như các ô trang Tổng quan/Người dùng/Nhật ký (theo ReadingTile Dashboard Farm Owner) */
const ICON = 'bg-warmGray/10 text-charcoal'

/**
 * Hàng 5 ô số đầu trang Thiết bị của Admin — cùng kiểu card "Chỉ số vận hành toàn hệ thống" (Tổng quan): bọc Card
 * + tiêu đề, ô bên trong bỏ shadow riêng, icon xám. Đếm từ `summary` của GET /devices/system-status (OPS-NFR-004),
 * toàn hệ thống, không theo bộ lọc bảng. Lỗi + Suy giảm gộp 1 ô "Cần xử lý". Chỉ ô báo vấn đề mới nổi, và chỉ khi
 * số > 0: Cần xử lý đỏ, Offline cam; Tổng/Online/Chờ kết nối luôn trắng. Dòng phụ mỗi ô vừa 1 dòng, không dùng từ kỹ thuật
 * "heartbeat".
 */
export default function DeviceStats({ status }: { status: SystemNodeStatus }) {
  const { summary, nodes } = status
  const sensors = nodes.filter(n => n.type === 'sensor').length
  const faulty = summary.offline // ERROR/DEGRADED đã bỏ (SRS 3.1.0) — Offline là trạng thái hư duy nhất

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">{t('Thống kê thiết bị')}</h2>
        <p className="mt-1 text-sm text-warmGray">{t('Cảm biến và camera trên mọi trang trại')}</p>
      </div>

      {/* 5 ô bằng nhau trên desktop; mobile: ô Tổng chiếm trọn hàng đầu, 4 ô còn lại xếp 2×2 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          className="col-span-2 shadow-none lg:col-span-1"
          icon={CpuIcon}
          iconClass={ICON}
          label="Tổng thiết bị"
          value={summary.total}
          sub={t('{{sensors}} cảm biến · {{cameras}} camera', { sensors, cameras: nodes.length - sensors })}
        />
        <StatTile
          className="shadow-none"
          icon={WifiHighIcon}
          iconClass={ICON}
          label="Online"
          value={summary.online}
          // Dòng phụ ngắn (vừa 1 dòng trong ô) và theo đúng số: 0 thì nói không có, không ghi "đang gửi dữ liệu" khi chẳng thiết bị nào gửi
          sub={summary.total === 0 ? 'Chưa có thiết bị' : summary.online === 0 ? 'Chưa có thiết bị online' : summary.online === summary.total ? 'Tất cả đang hoạt động' : 'Đang gửi dữ liệu'}
        />
        <StatTile
          className="shadow-none"
          icon={WifiSlashIcon}
          iconClass={ICON}
          label="Offline"
          value={summary.offline}
          // Có thiết bị offline → ô nổi cam (mất dữ liệu nhà yến, cần kiểm tra nguồn/mạng)
          tone={summary.offline > 0 ? 'warning' : undefined}
          // Flow 14: không nhận heartbeat > 30s → OFFLINE
          sub={summary.offline > 0 ? 'Mất tín hiệu quá 30 giây' : 'Tất cả đều kết nối'}
        />
        <StatTile
          className="shadow-none"
          icon={WarningIcon}
          iconClass={ICON}
          label="Cần xử lý"
          value={faulty}
          // Có thiết bị lỗi/suy giảm → ô nổi đỏ (nghiêm trọng nhất)
          tone={faulty > 0 ? 'critical' : undefined}
          sub={faulty > 0 ? `${faulty} thiết bị mất kết nối` : 'Không có thiết bị lỗi'}
        />
        <StatTile
          className="shadow-none"
          icon={HourglassIcon}
          iconClass={ICON}
          label="Chờ kết nối"
          value={summary.pending}
          // PENDING: đã đăng ký/kích hoạt nhưng chưa từng gửi heartbeat (FARM-FR-003) — chưa chắc đã lắp xong
          sub={summary.pending > 0 ? 'Chưa kết nối lần nào' : 'Không có thiết bị chờ'}
        />
      </div>
    </Card>
  )
}
