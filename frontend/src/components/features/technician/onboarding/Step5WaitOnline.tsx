// Step5WaitOnline.tsx — Bước 5: Chờ thiết bị kết nối MQTT (B6)
// 15 phút countdown + socket listener DEVICE_STATUS_CHANGE
//
// Fix: Gọi joinZone(data.zoneId) khi mount để socket vào đúng room zone:<zoneId>.
//      Backend emit DEVICE_STATUS_CHANGE tới room zone:<zoneId>, không phải broadcast.
//      Nếu không join room, wizard không bao giờ nhận được event → luôn timeout.
//
// Fix: useRef cho successTimer để clear khi unmount → tránh memory leak.
// Fix: Kiểm tra trạng thái thiết bị ngay khi mount (polling dự phòng) để handle
//      trường hợp thiết bị đã ONLINE trước khi vào Step 5.
//
// Giao diện: vòng đếm ngược 15 phút (SVG) + 3 mốc kết nối có đường nối — 100% từ socket/countdown thật.
import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, Loader2, AlertTriangle } from 'lucide-react'
import { useSocket } from '@/hooks/common/useSocket'
import { joinZone, leaveZone, onDeviceStatusChange } from '@/lib/socket'
import { deviceApi } from '@/apis/shared/devices.api'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { DeviceStatusChangeEvent } from '@/types'
import type { OnboardingState } from './onboardingTypes'

const TIMEOUT_MS = 15 * 60 * 1000 // 15 phút

// Vòng đếm ngược: bán kính 52 trong viewBox 120 → chu vi để tính stroke-dashoffset
const RING_R = 52
const RING_C = 2 * Math.PI * RING_R

interface Milestone { label: string; done: boolean }

/** 3 mốc nối bằng đường dọc; mốc đầu tiên chưa xong là "đang chờ" (spinner), các mốc sau là "chưa tới" */
function MilestoneList({ items }: { items: Milestone[] }) {
  const currentIdx = items.findIndex(m => !m.done)
  return (
    <ol className="flex w-full max-w-xs flex-col text-left">
      {items.map((m, i) => {
        const waiting = i === currentIdx
        return (
          <li key={m.label} className="relative flex items-center gap-3 pb-4 last:pb-0">
            {i < items.length - 1 && (
              <span aria-hidden className={cn('absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 rounded-full transition-colors duration-500', m.done ? 'bg-charcoal' : 'bg-graphite/15')} />
            )}
            <span
              className={cn(
                'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
                m.done && 'bg-charcoal text-white',
                waiting && 'bg-limeMist text-charcoal ring-1 ring-charcoal',
                !m.done && !waiting && 'bg-white text-warmGray ring-2 ring-graphite/15',
              )}
            >
              {m.done ? <Check size={14} strokeWidth={2.5} /> : waiting ? <Loader2 size={14} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" /> : <span className="h-1.5 w-1.5 rounded-full bg-graphite/30" />}
            </span>
            <span className={cn('text-sm', m.done ? 'font-medium text-charcoal' : waiting ? 'font-semibold text-charcoal' : 'text-warmGray')}>{m.label}</span>
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
  useSocket()
  const [elapsed, setElapsed]           = useState(0)
  const [timedOut, setTimedOut]         = useState(false)
  const [mqttOk, setMqttOk]             = useState(false)
  const [wifiConnecting, setWifiConnecting] = useState(false)
  const startRef      = useRef(Date.now())
  const successTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)   // Fix: ref để clear khi unmount

  // Stable callback tránh re-subscribe mỗi render
  const handleSuccess = useCallback(() => {
    successTimer.current = setTimeout(onSuccess, 800) // brief delay for visual feedback
  }, [onSuccess])

  // Fix: Tham gia room zone để nhận event DEVICE_STATUS_CHANGE
  useEffect(() => {
    const zoneId = data.location.zoneId
    if (!zoneId) return

    joinZone(zoneId)

    return () => {
      leaveZone(zoneId)
      // Fix: clear timer khi unmount để tránh memory leak
      if (successTimer.current) clearTimeout(successTimer.current)
    }
  }, [data.location.zoneId])

  // Fix: Polling dự phòng khi mount — bắt case thiết bị đã ONLINE trước khi vào Step 5.
  // Socket chỉ bắn khi có transition trạng thái SAU khi mount.
  // Nếu thiết bị online ở Step3/4, không có transition → không nhận socket event → timeout sai.
  useEffect(() => {
    if (!data.deviceDbId) return
    let cancelled = false
    // _id của CameraNode không tồn tại trong collection sensor → getSensorNode luôn 404; tra đúng danh sách camera của zone
    const fetchStatus = data.deviceType === 'CAMERA_NODE'
      ? deviceApi.listCameraNodes(data.location.zoneId)
          .then(res => res.data.data.find(n => n._id === data.deviceDbId)?.status)
      : deviceApi.getSensorNode(data.deviceDbId).then(res => res.data.data.status)
    fetchStatus
      .then(deviceStatus => {
        if (cancelled) return
        if (deviceStatus === 'ONLINE') {
          setMqttOk(true)
          handleSuccess()
        }
      })
      .catch(() => { /* Bỏ qua lỗi mạng — socket vẫn hoạt động song song */ })
    return () => { cancelled = true }
  }, [data.deviceDbId, data.deviceType, data.location.zoneId, handleSuccess])

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const el = Date.now() - startRef.current
      setElapsed(el)
      if (el > TIMEOUT_MS) setTimedOut(true)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Subscribe DEVICE_STATUS_CHANGE socket
  useEffect(() => {
    const off = onDeviceStatusChange((event: DeviceStatusChangeEvent) => {
      if (event.nodeId === data.deviceDbId) {
        if (event.status === 'ONLINE') {
          setMqttOk(true)
          handleSuccess()
        } else if (event.status === 'PENDING') {
          setWifiConnecting(true)
        }
      }
    })
    return () => { off() }
  }, [data.deviceDbId, handleSuccess])

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
        <ul className="w-full max-w-sm text-left text-sm text-warmGray">
          {[
            'WiFi nhà yến có thể bị nhập sai mật khẩu',
            'ESP32 chưa khởi động lại sau khi nhận config',
            'Khoảng cách WiFi quá xa, tín hiệu yếu',
            'MQTT broker đang bảo trì',
          ].map((r, i) => <li key={i} className="flex items-start gap-2">• <span>{r}</span></li>)}
        </ul>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button onClick={onRetry} className="w-full justify-center">Thử lại từ Bước 3</Button>
          <button onClick={onSuccess} className="text-sm text-warmGray hover:text-charcoal">
            Bỏ qua, tiếp tục nghiệm thu
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
        items={[
          { label: 'Đã nhận cấu hình WiFi', done: true },
          { label: 'Kết nối WiFi nhà yến', done: wifiConnecting || mqttOk },
          { label: 'Kết nối MQTT broker', done: mqttOk },
        ]}
      />
    </div>
  )
}
