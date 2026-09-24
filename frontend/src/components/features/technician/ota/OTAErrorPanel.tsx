// OTAErrorPanel.tsx — B8: 3 loại lỗi OTA với UI và actions riêng biệt
import { Button } from '@/components/ui'
import type { OTAError } from '@/components/features/technician/ota/otaTypes'

interface Props {
  error: OTAError
  currentFw: string
  targetFw: string
  onRetry: () => void
}

export function OTAErrorPanel({ error, currentFw, targetFw, onRetry }: Props) {
  if (error === 'DOWNLOAD_TIMEOUT') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-xl border border-alertRed/20 bg-alertRed/[0.08] px-4 py-3">
          <span className="text-xl">❌</span>
          <div>
            <p className="font-semibold text-alertRed">Tải firmware thất bại</p>
            <p className="text-sm text-alertRed/80">Thiết bị vẫn đang chạy {currentFw} — dữ liệu an toàn.</p>
          </div>
        </div>
        <Button onClick={onRetry} className="w-full justify-center">Thử lại</Button>
      </div>
    )
  }

  if (error === 'CHECKSUM_MISMATCH') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-xl border border-climateOrange/20 bg-climateOrange/[0.08] px-4 py-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-climateOrange">File firmware bị hỏng</p>
            <p className="text-sm text-climateOrange/80">Checksum không khớp — cần upload lại bản build mới từ CI/CD.</p>
          </div>
        </div>
        <button className="text-center text-sm font-semibold text-charcoal underline">
          Liên hệ team DevOps
        </button>
        <Button variant="secondary" onClick={onRetry} className="w-full justify-center">Huỷ</Button>
      </div>
    )
  }

  if (error === 'ROLLBACK') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-xl border border-climateOrange/20 bg-climateOrange/[0.08] px-4 py-3">
          <span className="text-xl">🔄</span>
          <div>
            <p className="font-semibold text-climateOrange">Boot loop phát hiện — đã rollback</p>
            <p className="text-sm text-climateOrange/80">
              ESP32 tự rollback về <strong>{currentFw}</strong>.{' '}
              <span className="line-through opacity-60">{targetFw}</span> bị gạch bỏ.
            </p>
          </div>
        </div>
        <Button className="w-full justify-center">Báo cáo lỗi firmware</Button>
        <Button variant="secondary" onClick={onRetry} className="w-full justify-center">Đóng</Button>
      </div>
    )
  }

  return null
}
