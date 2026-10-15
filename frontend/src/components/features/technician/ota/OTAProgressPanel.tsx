// OTAProgressPanel.tsx — trạng thái OTA thật: chờ thiết bị cập nhật (ota_pending) / thành công
// BE không trả % tiến trình nên chỉ hiển thị các mốc có thể kiểm chứng + thanh vô định (không vẽ % giả).
import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/helpers'

interface Props {
  done: boolean
  /** Phiên bản mục tiêu (x.y.z) */
  version: string
  requestedAt?: string
}

const STEPS = [
  'Đã gửi lệnh OTA tới thiết bị',
  'Thiết bị tải & ghi firmware, khởi động lại…',
  'Xác nhận firmware mới qua heartbeat',
]

/** "mm:ss" đã trôi qua kể từ requestedAt; tự cập nhật mỗi giây khi còn đang chờ */
function useElapsed(since: string | undefined, running: boolean): string | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!since || !running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [since, running])
  if (!since) return null
  const sec = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000))
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

export function OTAProgressPanel({ done, version, requestedAt }: Props) {
  const elapsed = useElapsed(requestedAt, !done)
  // done → cả 3 mốc xong; chờ → mốc 1 xong, mốc 2 đang chạy, mốc 3 chưa tới
  const activeIdx = done ? STEPS.length : 1

  return (
    <div className="flex flex-col gap-4">
      {done ? (
        <div className="flex items-center gap-3 rounded-xl bg-success/15 px-4 py-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-charcoal text-white">
            <Check size={16} strokeWidth={2.5} />
          </span>
          <div>
            <p className="font-semibold text-charcoal">Cập nhật thành công</p>
            <p className="text-sm text-charcoal/70">Firmware <span className="tabular-nums">{version}</span> đang chạy</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-charcoal">
            Đang chờ thiết bị cập nhật lên <span className="tabular-nums font-semibold">{version}</span>
            {requestedAt ? <span className="text-warmGray"> · gửi lúc {formatDate(requestedAt)}</span> : null}
          </p>
          {/* Thanh vô định 2px — báo "đang chạy" mà không giả vờ biết phần trăm */}
          <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-warmGray/15" role="progressbar" aria-label="Đang chờ thiết bị cập nhật">
            <div className="absolute inset-y-0 left-0 w-2/5 animate-indeterminate rounded-full bg-charcoal motion-reduce:animate-none" />
          </div>
          {elapsed && <p className="text-xs tabular-nums text-warmGray">Đã chờ {elapsed}</p>}
        </div>
      )}

      <ol className="flex flex-col">
        {STEPS.map((label, i) => {
          const stepDone = i < activeIdx
          const stepActive = !done && i === activeIdx
          return (
            <li key={label} className="relative flex items-start gap-3 pb-4 last:pb-0">
              {i < STEPS.length - 1 && (
                <span aria-hidden className={cn('absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 rounded-full transition-colors duration-500', i < activeIdx ? 'bg-charcoal' : 'bg-graphite/15')} />
              )}
              <span
                className={cn(
                  'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors duration-300',
                  stepDone && 'bg-charcoal text-white',
                  stepActive && 'bg-limeMist text-charcoal ring-1 ring-charcoal',
                  !stepDone && !stepActive && 'bg-white text-warmGray ring-2 ring-graphite/15',
                )}
              >
                {stepDone ? <Check size={14} strokeWidth={2.5} /> : stepActive ? <Loader2 size={14} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" /> : i + 1}
              </span>
              <p className={cn('pt-0.5 text-sm', stepDone || stepActive ? 'font-medium text-charcoal' : 'text-warmGray')}>{label}</p>
            </li>
          )
        })}
      </ol>

      {!done && <p className="text-xs text-warmGray">Hệ thống tự làm mới. Nếu sau 30 phút không có phản hồi, lệnh sẽ được đánh dấu thất bại.</p>}
    </div>
  )
}
