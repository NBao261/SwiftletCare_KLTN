// Step5WaitOnline — bước cuối: chờ thiết bị kết nối máy chủ trong 15 phút (socket DEVICE_STATUS_CHANGE + đọc trạng thái một lần)
import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, Loader2, AlertTriangle, Circle, RotateCcw } from 'lucide-react'
import { useDeviceStatusEvents } from '@/hooks/shared/useDevices'
import { deviceApi } from '@/apis/shared/devices.api'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { OnboardingState } from './onboardingTypes'

// 15 phút
const TIMEOUT_MS = 15 * 60 * 1000

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
  const [mqttOk, setMqttOk]             = useState(false)
  const [wifiConnecting, setWifiConnecting] = useState(false)
  const startRef      = useRef(Date.now())
  const successTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Chờ 800 ms cho người dùng thấy mốc cuối xong rồi mới chuyển
  const handleSuccess = useCallback(() => {
    successTimer.current = setTimeout(onSuccess, 800)
  }, [onSuccess])

  // Huỷ hẹn chuyển bước khi rời màn
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current) }, [])

  // Camera gắn nhà nên nghe ở room house:<houseId> (FARM-FR-004), bộ điều khiển ở room zone:<zoneId>
  useDeviceStatusEvents(
    data.deviceType === 'CAMERA_NODE' ? { houseId: data.location.houseId } : { zoneId: data.location.zoneId },
    data.deviceDbId,
    status => {
      if (status === 'ONLINE') {
        setMqttOk(true)
        handleSuccess()
      } else if (status === 'PENDING') {
        setWifiConnecting(true)
      }
    },
  )

  // Đọc trạng thái một lần khi mở bước: thiết bị đã ONLINE từ trước thì socket không còn sự kiện nào
  useEffect(() => {
    if (!data.deviceDbId) return
    let cancelled = false
    const fetchStatus = data.deviceType === 'CAMERA_NODE'
      ? deviceApi.listCameraNodes(data.location.houseId)
          .then(response => response.data.data.find(camera => camera._id === data.deviceDbId)?.status)
      : deviceApi.getSensorNode(data.deviceDbId).then(response => response.data.data.status)
    fetchStatus
      .then(deviceStatus => {
        if (cancelled) return
        if (deviceStatus === 'ONLINE') {
          setMqttOk(true)
          handleSuccess()
        }
      })
      // Lỗi mạng thì vẫn còn socket
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [data.deviceDbId, data.deviceType, data.location.houseId, data.location.zoneId, handleSuccess])

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

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Vòng đếm ngược 15' — chạy ngược theo thời gian còn lại; chấm "radar" lan ra khi chưa online */}
      <div className="relative flex h-36 w-36 items-center justify-center">
        {!mqttOk && <span aria-hidden className="absolute inset-3 animate-ping-soft rounded-full bg-limeMist motion-reduce:animate-none" />}
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="60" cy="60" r={RING_R} fill="none" strokeWidth="6" className="stroke-graphite/10" />
          <circle
            cx="60" cy="60" r={RING_R} fill="none" strokeWidth="6" strokeLinecap="round"
            className={cn('transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none', mqttOk ? 'stroke-success' : 'stroke-charcoal')}
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
        <h2 className="text-lg font-bold text-charcoal">{mqttOk ? 'Thiết bị đã kết nối' : 'Đang chờ thiết bị kết nối…'}</h2>
        <p className="mt-1 text-xs text-warmGray">Tự động chuyển bước khi thiết bị online</p>
      </div>

      <MilestoneList
        items={data.deviceType === 'CAMERA_NODE'
          ? [
              { label: 'Kết nối mạng', done: wifiConnecting || mqttOk },
              { label: 'Kết nối máy chủ', done: mqttOk },
            ]
          : [
              { label: 'Đã nhận cấu hình WiFi', done: true },
              { label: 'Kết nối WiFi nhà yến', done: wifiConnecting || mqttOk },
              { label: 'Kết nối máy chủ', done: mqttOk },
            ]}
      />
    </div>
  )
}
