import { Badge, Button } from '@/components/ui'
import { type DataTableColumn } from '@/components/ui/DataTable'
import StatusDot from '@/components/common/StatusDot'
import { formatRelativeTime, wifiQuality } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { t, translated } from '@/i18n'
import type { SystemNodeStatusItem } from '@/types'

// Cột heartbeat: 2 dòng giờ:phút:giây / ngày theo giờ VN — cùng kiểu cột Ngày tạo ở bảng Người dùng
const DAY_FORMAT = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
const TIME_FORMAT = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })

/**
 * Mức sóng Wi-Fi — cùng ngưỡng + tên mức với bảng thiết bị Farm Owner (wifiQuality: ≥ -55 Rất tốt · ≥ -67 Tốt ·
 * ≥ -75 Khá · thấp hơn Yếu). Thêm màu để Admin quét nhanh: tốt xanh hệ thống, Yếu cam như giá trị vượt ngưỡng.
 */
const WIFI_LABEL = translated({ excellent: 'Rất tốt', good: 'Tốt', fair: 'Khá', weak: 'Yếu' })
const WIFI_COLOR = { excellent: 'text-accent-700', good: 'text-accent-700', fair: 'text-charcoal', weak: 'text-climateOrange' }

/**
 * Ô Wi-Fi dùng chung bảng + popup chi tiết. RSSI chỉ cập nhật theo heartbeat → thiết bị không online thì đây là số
 * CŨ: xám nghiêng, không xếp mức (tránh "Offline" cạnh "Rất tốt"). Camera không gửi RSSI → "—".
 */
export function WifiSignal({ node }: { node: SystemNodeStatusItem }) {
  const q = wifiQuality(node.rssi)
  if (node.rssi == null || !q) return <span className="text-warmGray">—</span>
  if (node.status !== 'ONLINE' && node.status !== 'DEGRADED') {
    return <span className="italic text-warmGray" title={t('Đo lần cuối trước khi mất kết nối')}>{node.rssi} dBm</span>
  }
  return <span className={cn('font-bold', WIFI_COLOR[q])}>{node.rssi} dBm · {WIFI_LABEL[q]}</span>
}

/**
 * "Farm A | Nhà chính | Tầng 1 | Phòng 2" — luôn đủ 4 phần, kể cả khi tên zone trùng nhãn tầng; chỉ bỏ phần trống
 * (backend cũ chưa trả `floor`)
 */
export const nodeLocation = (n: SystemNodeStatusItem) =>
  [n.farm_name, n.house_name, n.floor != null && t('Tầng {{n}}', { n: n.floor }), n.zone_name].filter(Boolean).join(' | ')

/**
 * Ngày + giờ heartbeat 2 dòng (giờ đậm trên, ngày chữ thường dưới). `plainDate`: ngày màu chữ chính thay vì xám
 * (drawer chi tiết — ô giá trị đứng 1 mình, không cần làm mờ như trong bảng)
 */
export function HeartbeatTime({ at, plainDate = false }: { at?: string; plainDate?: boolean }) {
  // Chưa có heartbeat: nghiêng xám — cùng kiểu "Không có" ở Nhật ký hệ thống
  if (!at) return <span className="font-normal italic text-warmGray">{t('Chưa từng kết nối')}</span>
  const date = new Date(at)
  return (
    <div className="flex flex-col" title={formatRelativeTime(at)}>
      <span className="font-semibold text-charcoal">{TIME_FORMAT.format(date)}</span>
      <span className={cn('font-normal', plainDate ? 'text-charcoal' : 'text-small text-warmGray')}>{DAY_FORMAT.format(date)}</span>
    </div>
  )
}

/**
 * Cột bảng Thiết bị của Admin (AdminDevicesPage) — chỉ XEM: SRS RACI cho Admin "I (audit)" với gán/kích hoạt/
 * dời thiết bị và "–" với điều khiển relay, nên thao tác duy nhất là "Chi tiết" (popup chỉ đọc). Width %
 * (DataTable table-fixed), tổng 100: 5+19+15+13+14+9+14+11 — Thiết bị đủ chỗ mã + nhãn loại, Vị trí
 * chỉ còn tên farm nên hẹp lại.
 */
export function buildDeviceColumns(startIndex: number, onView: (n: SystemNodeStatusItem) => void): DataTableColumn<SystemNodeStatusItem>[] {
  return [
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[5%]',
      render: (_n, index) => <span className="text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      key: 'device_id', header: 'Thiết bị', className: 'w-[19%]',
      render: n => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-bold text-charcoal" title={n.device_id}>{n.device_id}</span>
          <Badge tone="neutral" className="shrink-0">{n.type === 'sensor' ? 'Cảm biến' : 'Camera'}</Badge>
        </div>
      ),
    },
    {
      key: 'location', header: 'Vị trí', className: 'w-[15%]',
      // Chỉ tên farm (in đậm) — nhà | tầng | zone xem ở popup Chi tiết; rê chuột vẫn thấy đủ vị trí.
      // Ô tìm kiếm vẫn khớp cả chuỗi vị trí đầy đủ (nodeLocation)
      render: n => (
        <span className="line-clamp-2 break-words font-bold text-charcoal" title={nodeLocation(n)}>{n.farm_name || '—'}</span>
      ),
    },
    {
      key: 'status', header: 'Trạng thái', className: 'w-[13%]',
      render: n => <StatusDot status={n.status} colored />,
    },
    { key: 'rssi', header: 'Wi-Fi', className: 'w-[14%] whitespace-nowrap', render: n => <WifiSignal node={n} /> },
    {
      key: 'firmware', header: 'Firmware', className: 'w-[9%] whitespace-nowrap',
      render: n => n.firmware_version
        ? <span className="font-medium text-charcoal">v{n.firmware_version}</span>
        : <span className="text-warmGray">—</span>,
    },
    { key: 'last_heartbeat', header: 'Heartbeat', className: 'w-[14%] whitespace-nowrap', render: n => <HeartbeatTime at={n.last_heartbeat} /> },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[11%] whitespace-nowrap',
      render: n => (
        <Button variant="secondary" size="sm" onClick={e => { e.stopPropagation(); onView(n) }}>Chi tiết</Button>
      ),
    },
  ]
}
