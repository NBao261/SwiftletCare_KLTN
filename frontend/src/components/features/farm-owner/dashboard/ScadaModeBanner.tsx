import { useEffect, useState } from 'react'
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
  // secondsAgoLabel() chỉ tính lại lúc component render — không có gì kích render lại nên dòng chữ
  // đứng yên (VD kẹt ở "22s trước") đúng lúc thiết bị mất kết nối và người dùng cần biết đã bao lâu.
  // Tick nhẹ mỗi giây để label luôn khớp thời gian thực.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
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
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.round(hours / 24)
  return `${days} ngày trước`
}
