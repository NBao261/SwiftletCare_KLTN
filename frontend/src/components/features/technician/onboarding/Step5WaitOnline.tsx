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
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSocket } from '@/hooks/common/useSocket'
import { joinZone, leaveZone, onDeviceStatusChange } from '@/lib/socket'
import { deviceApi } from '@/apis/shared/devices.api'
import { Button } from '@/components/ui'
import type { DeviceStatusChangeEvent } from '@/types'
import type { OnboardingState } from './onboardingTypes'

const TIMEOUT_MS = 15 * 60 * 1000 // 15 phút

function StatusCheck({ label, done, loading }: { label: string; done: boolean; loading?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{done ? '✅' : loading ? '⏳' : '○'}</span>
      <span className={done ? 'font-medium text-charcoal' : 'text-warmGray'}>{label}</span>
    </div>
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
    deviceApi.getSensorNode(data.deviceDbId)
      .then(res => {
        if (cancelled) return
        if (res.data.data.status === 'ONLINE') {
          setMqttOk(true)
          handleSuccess()
        }
      })
      .catch(() => { /* Bỏ qua lỗi mạng — socket vẫn hoạt động song song */ })
    return () => { cancelled = true }
  }, [data.deviceDbId, handleSuccess])

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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-alertRed/10 text-4xl">❌</div>
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

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-graphite/10 border-t-charcoal" />
        <span className="text-2xl">📡</span>
      </div>

      <div>
        <h2 className="text-lg font-bold text-charcoal">Đang chờ thiết bị kết nối…</h2>
        <p className="mt-1 font-mono text-2xl font-bold text-charcoal">
          {String(remainMins).padStart(2, '0')}:{String(remainSecs).padStart(2, '0')} / 15:00
        </p>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <StatusCheck label="Đã nhận cấu hình WiFi" done />
        <StatusCheck label="Đang kết nối WiFi nhà yến" done={wifiConnecting} loading />
        <StatusCheck label="Chờ kết nối MQTT broker" done={mqttOk} loading={!mqttOk} />
      </div>

      <p className="text-xs text-warmGray">Tự động chuyển bước khi thiết bị online</p>
    </div>
  )
}
