// OTAProgressPanel.tsx — trạng thái OTA thật: chờ thiết bị cập nhật (ota_pending) / thành công
// BE không trả % tiến trình nên chỉ hiển thị các mốc có thể kiểm chứng.
import { formatDate } from '@/lib/helpers'

interface Props {
  done: boolean
  /** Phiên bản mục tiêu (x.y.z) */
  version: string
  requestedAt?: string
}

export function OTAProgressPanel({ done, version, requestedAt }: Props) {
  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-limeMist/30 bg-limeMist/15 px-4 py-3">
        <span className="text-xl">✅</span>
        <div>
          <p className="font-semibold text-charcoal">Cập nhật thành công!</p>
          <p className="text-sm text-charcoal/70">Firmware {version} đang chạy</p>
        </div>
      </div>
    )
  }

  const steps = [
    { label: 'Đã gửi lệnh OTA tới thiết bị', status: 'done' as const },
    { label: 'Thiết bị tải & ghi firmware, khởi động lại…', status: 'active' as const },
    { label: 'Xác nhận firmware mới qua heartbeat', status: 'pending' as const },
  ]

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-charcoal">
        Đang chờ thiết bị cập nhật lên <span className="font-mono font-semibold">{version}</span>
        {requestedAt ? <span className="text-warmGray"> · gửi lúc {formatDate(requestedAt)}</span> : null}
      </p>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            step.status === 'done'   ? 'bg-charcoal text-white' :
            step.status === 'active' ? 'animate-pulse bg-limeMist text-charcoal ring-1 ring-charcoal' :
                                       'bg-graphite/15 text-warmGray'
          }`}>
            {step.status === 'done' ? '✓' : i + 1}
          </span>
          <p className={`text-sm ${step.status === 'pending' ? 'text-warmGray' : 'font-medium text-charcoal'}`}>{step.label}</p>
        </div>
      ))}
      <p className="text-xs text-warmGray">Hệ thống tự làm mới. Nếu sau 30 phút không có phản hồi, lệnh sẽ được đánh dấu thất bại.</p>
    </div>
  )
}
