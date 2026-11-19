// Step5WaitOnline — bước cuối (FARM-FR-012): chờ thiết bị kết nối máy chủ trong 15 phút (socket DEVICE_STATUS_CHANGE + đọc trạng thái một lần);
// bộ điều khiển còn chờ tới khi áp cấu hình của Zone (config_sync, ENV-FR-027) — cùng các bước với màn lắp đặt của mobile
import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, Loader2, AlertTriangle, Circle, RotateCcw } from 'lucide-react'
import { useDeviceStatusEvents, useSensorNode } from '@/hooks/shared/useDevices'
import { useHouseCameras } from '@/hooks/farm-owner/useHouseCameras'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { OnboardingState } from './onboardingTypes'

// 15 phút
const TIMEOUT_MS = 15 * 60 * 1000
// Đọc lại trạng thái: controller gửi heartbeat 30 s/lần (MQTT_HEARTBEAT_MS) và backend so phiên bản cấu hình ở mỗi heartbeat
const CONFIG_POLL_MS = 10_000

// Vòng đếm ngược: bán kính 52 trong viewBox 120 → chu vi để tính stroke-dashoffset
const RING_R = 52
const RING_C = 2 * Math.PI * RING_R

interface Milestone { label: string; done: boolean }

// Các mốc nối bằng đường dọc; mốc đầu tiên chưa xong là "đang chờ", các mốc sau là "chưa tới"
function MilestoneList({ items }: { items: Milestone[] }) {
  const currentIndex = items.findIndex(milestone => !milestone.done)
  return (
    <ol className="flex w-full max-w-xs flex-col text-left">
      {items.map((milestone, index) => {
        const waiting = index === currentIndex
        return (
          <li key={milestone.label} className="relative flex items-center gap-3 pb-4 last:pb-0">
            {index < items.length - 1 && (
              <span aria-hidden className={cn('absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 rounded-full transition-colors duration-500', milestone.done ? 'bg-charcoal' : 'bg-graphite/15')} />
            )}
            <span
              className={cn(
                'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
                milestone.done && 'bg-charcoal text-white',
                waiting && 'bg-limeMist text-charcoal ring-1 ring-charcoal',
                !milestone.done && !waiting && 'bg-white text-warmGray ring-2 ring-graphite/15',
              )}
            >
              {milestone.done ? <Check size={14} strokeWidth={2.5} /> : waiting ? <Loader2 size={14} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" /> : <Circle size={8} className="fill-current text-graphite/30" />}
            </span>
            <span className={cn('text-sm', milestone.done ? 'font-medium text-charcoal' : waiting ? 'font-semibold text-charcoal' : 'text-warmGray')}>{milestone.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

interface Props {
  data: OnboardingState
  onSuccess: () => void
  onRetry: () => void
}

export function Step5WaitOnline({ data, onSuccess, onRetry }: Props) {
  const [elapsed, setElapsed]           = useState(0)
  const [timedOut, setTimedOut]         = useState(false)
  // Sự kiện socket DEVICE_STATUS_CHANGE: báo ngay, không chờ lần đọc lại
  const [socketOnline, setSocketOnline] = useState(false)
  const [wifiConnecting, setWifiConnecting] = useState(false)
  const isCamera = data.deviceType === 'CAMERA_NODE'
  const startRef      = useRef(Date.now())
  const successTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trạng thái đọc từ API (thiết bị đã ONLINE từ trước thì socket không còn sự kiện nào): controller đọc lại tới khi áp xong cấu hình
  const { data: sensor } = useSensorNode(isCamera ? undefined : data.deviceDbId, CONFIG_POLL_MS)
  const { data: cameras } = useHouseCameras(isCamera ? data.location.houseId : undefined)
  const fetchedStatus = isCamera ? cameras?.find(camera => camera._id === data.deviceDbId)?.status : sensor?.status
  const online = socketOnline || fetchedStatus === 'ONLINE'
  // ENV-FR-027 — APPLIED, hoặc UNKNOWN (firmware trước 2.1.0 không báo phiên bản) thì coi như xong; camera không có bước này
  const configSync = sensor?.config_sync
  const configApplied = configSync === 'APPLIED' || configSync === 'UNKNOWN'
  const ready = online && (isCamera || configApplied)
  // Đã online mà cấu hình không khớp, hoặc hết giờ mà chưa áp: lỗi cấu hình, không phải lỗi Wi-Fi
  const configStuck = !isCamera && online && (configSync === 'MISMATCH' || (timedOut && !configApplied))

  // Chờ 800 ms cho người dùng thấy mốc cuối xong rồi mới chuyển; chỉ hẹn 1 lần
  const handleSuccess = useCallback(() => {
    if (!successTimer.current) successTimer.current = setTimeout(onSuccess, 800)
  }, [onSuccess])

  // Huỷ hẹn chuyển bước khi rời màn
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current) }, [])

  useEffect(() => { if (ready) handleSuccess() }, [ready, handleSuccess])

  // Camera gắn nhà nên nghe ở room house:<houseId> (FARM-FR-004), bộ điều khiển ở room zone:<zoneId>
  useDeviceStatusEvents(
    isCamera ? { houseId: data.location.houseId } : { zoneId: data.location.zoneId },
    data.deviceDbId,
    status => {
      if (status === 'ONLINE') setSocketOnline(true)
      else if (status === 'PENDING') setWifiConnecting(true)
    },
  )

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedMs = Date.now() - startRef.current
      setElapsed(elapsedMs)
      if (elapsedMs > TIMEOUT_MS) setTimedOut(true)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const remaining   = Math.max(0, TIMEOUT_MS - elapsed)
  const remainMins  = Math.floor(remaining / 60_000)
  const remainSecs  = Math.floor((remaining % 60_000) / 1000)

  if (configStuck) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-alertRed/10 text-alertRed">
          <AlertTriangle size={30} strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-charcoal">Thiết bị đã kết nối nhưng chưa áp cấu hình của khu vực</h2>
          <p className="mt-1 text-sm text-warmGray">
            Hệ thống vẫn gửi lại cấu hình; nếu không khớp, cảnh báo CONFIG_MISMATCH sẽ hiện ở trang Cảnh báo. Kiểm tra lại phiên bản firmware của thiết bị.
          </p>
        </div>
        <Button onClick={onSuccess} className="w-full max-w-xs justify-center">Về danh sách thiết bị</Button>
      </div>
    )
  }

  if (timedOut) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-alertRed/10 text-alertRed">
          <AlertTriangle size={30} strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-charcoal">Kích hoạt quá hạn</h2>
          <p className="mt-1 text-sm text-warmGray">Thiết bị không gửi tín hiệu trong 15 phút.</p>
        </div>
        <ul className="w-full max-w-sm list-disc space-y-1 pl-5 text-left text-sm text-warmGray">
          {[
            'WiFi nhà yến có thể bị nhập sai mật khẩu',
            'Thiết bị chưa khởi động lại sau khi nhận cấu hình',
            'Khoảng cách WiFi quá xa, tín hiệu yếu',
            'Máy chủ đang bảo trì',
          ].map(reason => <li key={reason}>{reason}</li>)}
        </ul>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button onClick={onRetry} className="w-full justify-center">
            <RotateCcw className="h-4 w-4" />
            Thử lại
          </Button>
          <button onClick={onSuccess} className="text-sm text-warmGray hover:text-charcoal">
            Bỏ qua, về danh sách thiết bị
          </button>
        </div>
      </div>
    )
  }

  const progress = Math.min(1, elapsed / TIMEOUT_MS)
  let heading = 'Đang chờ thiết bị kết nối…'
  if (ready) heading = 'Thiết bị đã sẵn sàng'
  else if (online) heading = 'Đang áp cấu hình của khu vực…'
  const hint = configSync === 'UNKNOWN'
    ? 'Firmware cũ không báo phiên bản cấu hình — kiểm tra lại sau khi cập nhật firmware'
    : 'Tự động chuyển bước khi thiết bị sẵn sàng'

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Vòng đếm ngược 15' — chạy ngược theo thời gian còn lại; chấm "radar" lan ra khi chưa online */}
      <div className="relative flex h-36 w-36 items-center justify-center">
        {!online && <span aria-hidden className="absolute inset-3 animate-ping-soft rounded-full bg-limeMist motion-reduce:animate-none" />}
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="60" cy="60" r={RING_R} fill="none" strokeWidth="6" className="stroke-graphite/10" />
          <circle
            cx="60" cy="60" r={RING_R} fill="none" strokeWidth="6" strokeLinecap="round"
            className={cn('transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none', online ? 'stroke-success' : 'stroke-charcoal')}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * progress}
          />
        </svg>
        <div className="relative z-10 flex flex-col items-center">
          <span className="text-metric tabular-nums text-charcoal" role="timer" aria-label="Thời gian còn lại">
            {String(remainMins).padStart(2, '0')}:{String(remainSecs).padStart(2, '0')}
          </span>
          <span className="text-xs text-warmGray">còn lại / 15:00</span>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-charcoal">{heading}</h2>
        <p className="mt-1 text-xs text-warmGray">{hint}</p>
      </div>

      <MilestoneList
        items={isCamera
          ? [
              { label: 'Kết nối mạng', done: wifiConnecting || online },
              { label: 'Kết nối máy chủ', done: online },
            ]
          : [
              { label: 'Đã nhận cấu hình WiFi', done: true },
              { label: 'Kết nối WiFi nhà yến', done: wifiConnecting || online },
              { label: 'Kết nối máy chủ', done: online },
              { label: 'Áp cấu hình của khu vực', done: configApplied },
            ]}
      />
    </div>
  )
}
