import { CaretRightIcon } from '@phosphor-icons/react'
import { type DataTableColumn } from '@/components/ui/DataTable'
import SimulatedBadge from '@/components/common/SimulatedBadge'
import StatusDot from '@/components/common/StatusDot'
import { formatRelativeTime, wifiQuality } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { nodeLocation } from '@/lib/deviceLocation'
import { nodePlace } from '@/components/features/admin/devices/deviceList.utils'
import { t, translated } from '@/i18n'
import type { SystemNodeStatusItem } from '@/types'

// Cột heartbeat: 2 dòng giờ:phút:giây / ngày theo giờ VN: cùng kiểu cột Ngày tạo ở bảng Người dùng
const DAY_FORMAT = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
const TIME_FORMAT = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })

// Cùng ngưỡng mức sóng với bảng thiết bị Farm Owner
const WIFI_LABEL = translated({ excellent: 'Rất tốt', good: 'Tốt', fair: 'Khá', weak: 'Yếu' })
const WIFI_COLOR = { excellent: 'text-accent-700', good: 'text-accent-700', fair: 'text-charcoal', weak: 'text-climateOrange' }

// Thiết bị không online thì RSSI là số cũ: hiện xám, không xếp mức
export function WifiSignal({ node }: { node: SystemNodeStatusItem }) {
  const q = wifiQuality(node.rssi)
  if (node.rssi == null || !q) return <span className="text-warmGray">—</span>
  if (node.status !== 'ONLINE') { // DEGRADED đã bỏ
    return <span className="italic text-warmGray" title={t('Đo lần cuối trước khi mất kết nối')}>{node.rssi} dBm</span>
  }
  return <span className={cn('font-bold', WIFI_COLOR[q])}>{node.rssi} dBm · {WIFI_LABEL[q]}</span>
}

// Giờ trên, ngày dưới
export function HeartbeatTime({ at, plainDate = false }: { at?: string; plainDate?: boolean }) {
  // Chưa có heartbeat: nghiêng xám: cùng kiểu "Không có" ở Nhật ký hệ thống
  if (!at) return <span className="font-normal italic text-warmGray">{t('Chưa từng kết nối')}</span>
  const date = new Date(at)
  return (
    <div className="flex flex-col" title={formatRelativeTime(at)}>
      <span className="font-semibold text-charcoal">{TIME_FORMAT.format(date)}</span>
      <span className={cn('font-normal', plainDate ? 'text-charcoal' : 'text-small text-warmGray')}>{DAY_FORMAT.format(date)}</span>
    </div>
  )
}

// Lần kết nối cuối: "3 ngày trước" đậm, ngày dưới; chưa từng kết nối thì nghiêng xám
function LastSeen({ at }: { at?: string }) {
  if (!at) return <span className="font-normal italic text-warmGray">{t('Chưa từng kết nối')}</span>
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-charcoal">{formatRelativeTime(at)}</span>
      <span className="text-small font-normal text-warmGray">{DAY_FORMAT.format(new Date(at))}</span>
    </div>
  )
}

// Quản trị viên chỉ xem thiết bị: bấm cả dòng mở chi tiết, mũi tên cuối dòng báo dòng bấm được
export function buildDeviceColumns(): DataTableColumn<SystemNodeStatusItem>[] {
  return [
    {
      key: 'device_id', header: 'Thiết bị', className: 'w-[20%]',
      // Ô 2 tầng: mã thiết bị đậm, loại thiết bị chữ xám bên dưới (nhãn dài không chèn mất mã)
      render: n => (
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-bold text-charcoal" title={n.device_id}>{n.device_id}</span>
            <SimulatedBadge simulated={n.simulated} />
          </div>
          <span className="text-small text-warmGray">{n.type === 'sensor' ? t('Bộ điều khiển') : t('Camera đếm chim')}</span>
        </div>
      ),
    },
    {
      key: 'location', header: 'Vị trí', className: 'w-[23%]',
      // Trang trại đậm, nhà và Zone bên dưới; đủ cả Tầng ở tooltip và vẫn tìm kiếm được
      render: n => (
        <div className="flex min-w-0 flex-col" title={nodeLocation(n)}>
          <span className="truncate font-semibold text-charcoal">{n.farm_name || '—'}</span>
          <span className="truncate text-small text-warmGray">{nodePlace(n) || '—'}</span>
        </div>
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
    { key: 'last_heartbeat', header: 'Kết nối cuối', className: 'w-[15%] whitespace-nowrap', render: n => <LastSeen at={n.last_heartbeat} /> },
    {
      key: 'open', header: '', align: 'right', className: 'w-[6%]',
      render: () => <CaretRightIcon size={16} weight="bold" aria-hidden className="ml-auto text-warmGray" />,
    },
  ]
}
