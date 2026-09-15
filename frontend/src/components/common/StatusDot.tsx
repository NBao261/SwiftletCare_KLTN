import { cn } from '@/utils/cn'
import type { DeviceStatus } from '@/types'

const STATUS_CLASS: Record<DeviceStatus, string> = {
  PENDING:  'bg-insightPeach',
  ONLINE:   'bg-limeMist',
  OFFLINE:  'bg-warmGray',
  ERROR:    'bg-alertRed',
  DEGRADED: 'bg-climateOrange',
}

const STATUS_LABEL: Record<DeviceStatus, string> = {
  // PENDING = đã khai báo nhưng chưa từng gửi heartbeat (Flow 1 bước 4→8)
  PENDING: 'Chờ kết nối', ONLINE: 'Online', OFFLINE: 'Offline', ERROR: 'Lỗi', DEGRADED: 'Suy giảm',
}

interface StatusDotProps {
  status: DeviceStatus
  showLabel?: boolean
  className?: string
}

/** StatusDot – chấm trạng thái thiết bị (FARM-FR-005) */
export default function StatusDot({ status, showLabel = true, className }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('h-2 w-2 rounded-full', STATUS_CLASS[status], status === 'ONLINE' && 'animate-pulse')} />
      {showLabel && <span className="text-xs font-medium text-warmGray">{STATUS_LABEL[status]}</span>}
    </span>
  )
}
