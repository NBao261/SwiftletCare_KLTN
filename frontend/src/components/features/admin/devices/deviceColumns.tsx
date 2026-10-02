import { Badge } from '@/components/ui'
import { type DataTableColumn } from '@/components/ui/DataTable'
import StatusDot from '@/components/common/StatusDot'
import { formatRelativeTime } from '@/lib/helpers'
import type { SystemNodeStatusItem } from '@/types'

// Cột heartbeat: 2 dòng giờ:phút / ngày theo giờ VN — cùng kiểu cột Ngày tạo ở bảng Ticket
const DAY_FORMAT = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
const TIME_FORMAT = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })

export const nodeLocation = (n: SystemNodeStatusItem) => `${n.farm_name} › ${n.house_name} › ${n.zone_name}`

/**
 * Cột bảng Thiết bị của Admin (AdminDevicesPage) — chỉ XEM: SRS RACI cho Admin "I (audit)" với gán/kích hoạt/
 * dời thiết bị và "–" với điều khiển relay, nên không có cột thao tác. Width % (DataTable table-fixed), tổng 100:
 * 5+22+30+14+12+17.
 */
export function buildDeviceColumns(startIndex: number): DataTableColumn<SystemNodeStatusItem>[] {
  return [
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[5%]',
      render: (_n, index) => <span className="tabular-nums text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      key: 'device_id', header: 'Thiết bị', className: 'w-[22%]',
      render: n => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-charcoal" title={n.device_id}>{n.device_id}</span>
          <Badge tone="neutral" className="shrink-0">{n.type === 'sensor' ? 'Cảm biến' : 'Camera'}</Badge>
        </div>
      ),
    },
    {
      key: 'location', header: 'Vị trí', className: 'w-[30%]',
      render: n => <span className="block truncate text-charcoal" title={nodeLocation(n)}>{nodeLocation(n)}</span>,
    },
    {
      key: 'status', header: 'Trạng thái', className: 'w-[14%]',
      render: n => <StatusDot status={n.status} />,
    },
    {
      key: 'rssi', header: 'Tín hiệu', className: 'w-[12%] whitespace-nowrap',
      // RSSI chỉ có ở cảm biến ESP32 (camera không gửi)
      render: n => n.rssi !== undefined
        ? <span className="tabular-nums text-charcoal">{n.rssi} dBm</span>
        : <span className="text-warmGray">—</span>,
    },
    {
      key: 'last_heartbeat', header: 'Heartbeat gần nhất', className: 'w-[17%] whitespace-nowrap',
      render: n => {
        if (!n.last_heartbeat) return <span className="text-small text-warmGray">Chưa từng kết nối</span>
        const at = new Date(n.last_heartbeat)
        return (
          <div className="flex flex-col tabular-nums" title={formatRelativeTime(n.last_heartbeat)}>
            <span className="text-charcoal">{TIME_FORMAT.format(at)}</span>
            <span className="text-small text-warmGray">{DAY_FORMAT.format(at)}</span>
          </div>
        )
      },
    },
  ]
}
