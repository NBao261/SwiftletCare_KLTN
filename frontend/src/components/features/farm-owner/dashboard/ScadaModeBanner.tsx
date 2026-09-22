import { Radio } from 'lucide-react'
import { Badge } from '@/components/ui'

/**
 * Banner đầu Dashboard — khai báo rõ phần lớn nội dung bên dưới (điểm sinh
 * thái tổng hợp, % hiệu năng SCADA, AI Vision, mật độ làm tổ, log SCADA) là
 * minh hoạ, chưa có công thức/API thật (FE_Design_Claude.md §7). "PLC" ở đây
 * bám vào chính SensorNode đang chạy PID control tại zone — badge Online/Offline
 * và "Synced Xs trước" là dữ liệu THẬT lấy từ socket telemetry, không phải fake.
 */
export default function ScadaModeBanner({
  isLive,
  hasEverReceived,
  lastSyncedAt,
}: {
  isLive: boolean
  hasEverReceived: boolean
  lastSyncedAt?: string
}) {
  const syncedLabel = lastSyncedAt ? secondsAgoLabel(lastSyncedAt) : 'Chưa đồng bộ'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warmGray/15 bg-white px-4 py-3 shadow-card">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-climateOrange" />
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-charcoal">
          Chế độ vận hành mô phỏng SCADA
        </span>
        <span className="text-warmGray/50">—</span>
        <p className="text-[11px] font-medium italic text-warmGray">This data is FAKE and has not been MOCKAPI</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={isLive ? 'positive' : hasEverReceived ? 'critical' : 'neutral'}>
          <Radio width={12} height={12} />
          PLC: {isLive ? 'Online' : hasEverReceived ? 'Mất kết nối' : 'Đang chờ'}
        </Badge>
        <span className="text-xs text-warmGray">Đồng bộ {syncedLabel}</span>
      </div>
    </div>
  )
}

function secondsAgoLabel(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s trước`
  const minutes = Math.round(seconds / 60)
  return `${minutes} phút trước`
}
