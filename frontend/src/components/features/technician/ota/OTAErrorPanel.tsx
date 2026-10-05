// OTAErrorPanel.tsx — B8: OTA thất bại (BE: ota_failed sau 30 phút không có phản hồi) hoặc lỗi gửi lệnh
import { Button } from '@/components/ui'
import { formatDate } from '@/lib/helpers'

interface Props {
  /** Phiên bản đã yêu cầu nhưng thất bại */
  failedVersion: string
  failedAt?: string
  /** Phiên bản thiết bị đang chạy thực tế */
  runningVersion?: string
  onRetry: () => void
}

export function OTAErrorPanel({ failedVersion, failedAt, runningVersion, onRetry }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-xl border border-alertRed/20 bg-alertRed/[0.08] px-4 py-3">
        <span className="text-xl">❌</span>
        <div>
          <p className="font-semibold text-alertRed">Cập nhật firmware thất bại</p>
          <p className="text-sm text-alertRed/80">
            Thiết bị không xác nhận được bản <span className="font-mono">{failedVersion}</span>
            {failedAt ? ` (lúc ${formatDate(failedAt)})` : ''}
            {runningVersion ? <> — đang chạy <span className="font-mono">{runningVersion}</span>, dữ liệu an toàn.</> : '.'}
          </p>
        </div>
      </div>
      <Button onClick={onRetry} className="w-full justify-center">Thử lại</Button>
    </div>
  )
}
