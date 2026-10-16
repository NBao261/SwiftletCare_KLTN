import { cn } from '@/lib/cn'
import type { DeviceStatus } from '@/types'
import { translated } from '@/i18n'

const STATUS_CLASS: Record<DeviceStatus, string> = {
  PENDING:  'bg-orange-300', // chờ kết nối lần đầu — nhạt hơn DEGRADED để phân biệt 2 mức "chưa ổn"
  ONLINE:   'bg-success',
  OFFLINE:  'bg-gray-400',
  ERROR:    'bg-alertRed',
  DEGRADED: 'bg-climateOrange',
}

const STATUS_LABEL: Record<DeviceStatus, string> = translated({
  // PENDING = đã khai báo nhưng chưa từng gửi heartbeat (Flow 1 bước 4→8)
  PENDING: 'Chờ kết nối', ONLINE: 'Online', OFFLINE: 'Offline', ERROR: 'Lỗi', DEGRADED: 'Suy giảm',
})

/** Màu chữ cùng tông chấm nhưng đậm hơn 1–2 nấc cho đọc được trên nền trắng (dùng khi `colored`) */
const STATUS_TEXT: Record<DeviceStatus, string> = {
  PENDING:  'text-orange-500',
  ONLINE:   'text-accent-700',
  OFFLINE:  'text-gray-600',
  ERROR:    'text-alertRed',
  DEGRADED: 'text-orange-700',
}

interface StatusDotProps {
  status: DeviceStatus
  showLabel?: boolean
  /** Nhãn in đậm + màu theo trạng thái (bảng Thiết bị của Admin) thay vì chữ xám nhỏ */
  colored?: boolean
  className?: string
}

/** StatusDot – chấm trạng thái thiết bị (FARM-FR-005) */
export default function StatusDot({ status, showLabel = true, colored = false, className }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('h-2 w-2 rounded-full', STATUS_CLASS[status], status === 'ONLINE' && 'animate-pulse')} />
      {showLabel && (
        <span className={colored ? cn('font-bold', STATUS_TEXT[status]) : 'text-xs font-medium text-warmGray'}>
          {STATUS_LABEL[status]}
        </span>
      )}
    </span>
  )
}
