// Bước cuối: chờ thiết bị gửi tín hiệu trong 15 phút rồi báo kết quả; chỉ nói điều hệ thống thật sự biết
import { useState, useEffect, useRef } from 'react'
import { Check, Loader2, AlertTriangle, Circle, RotateCcw, XCircle, CheckCircle2 } from 'lucide-react'
import { useDeviceStatusEvents, useSensorNode } from '@/hooks/shared/useDevices'
import { useHouseCameras } from '@/hooks/farm-owner/useHouseCameras'
import { Button } from '@/components/ui'
import CameraSourceHelp from '@/components/features/farm-owner/devices/CameraSourceHelp'
import CameraSourceModal from '@/components/features/farm-owner/devices/CameraSourceModal'
import { canSetCameraSource } from '@/components/features/farm-owner/devices/deviceActions'
import { devicesDict } from '@/constants/devices.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/cn'
import { formatDateTime, formatHourMinute } from '@/lib/i18n'
import { SETUP_TIMEOUT_MS, evaluateSetup, type ProgressStep } from './setupProgress'
import type { OnboardingState } from './onboardingTypes'

// Controller gửi heartbeat 30 s/lần, backend so phiên bản cấu hình ở mỗi heartbeat
const CONFIG_POLL_MS = 10_000

// Việc nên kiểm tra khi không có tín hiệu, xếp theo thứ tự nên làm; không khẳng định nguyên nhân
const SENSOR_CHECKS = [
  'Thiết bị còn được cấp nguồn.',
  'Wi-Fi nhập vào là mạng 2,4 GHz (thiết bị không kết nối được mạng 5 GHz).',
  'Tên và mật khẩu Wi-Fi nhập đúng, thiết bị đã khởi động lại sau khi lưu.',
  'Thiết bị đủ gần bộ phát Wi-Fi để có sóng.',
  'Nếu vẫn không được, báo Quản trị viên kiểm tra máy chủ.',
]
const CAMERA_CHECKS = [
  'Máy chạy camera đếm chim đang bật và có kết nối Internet.',
  'Camera đếm chim đã nhập đúng mã thiết bị này (mã cài đặt do Quản trị viên cấp).',
  'Nếu vẫn không được, báo Quản trị viên kiểm tra máy chủ.',
]

// Vòng đếm ngược: bán kính 52 trong viewBox 120 → chu vi để tính stroke-dashoffset
const RING_R = 52
const RING_C = 2 * Math.PI * RING_R

// Các mốc nối bằng đường dọc, mỗi mốc kèm thời điểm hoặc lý do cụ thể
function StepList({ steps }: { steps: ProgressStep[] }) {
  return (
    <ol className="flex w-full max-w-sm flex-col text-left">
      {steps.map((step, index) => (
        <li key={step.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
          {index < steps.length - 1 && (
            <span aria-hidden className={cn('absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 rounded-full transition-colors duration-500', step.state === 'done' ? 'bg-charcoal' : 'bg-graphite/15')} />
          )}
          <span
            className={cn(
              'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
              step.state === 'done' && 'bg-charcoal text-white',
              step.state === 'active' && 'bg-limeMist text-charcoal ring-1 ring-charcoal',
              step.state === 'failed' && 'bg-alertRed text-white',
              step.state === 'pending' && 'bg-white text-warmGray ring-2 ring-graphite/15',
            )}
          >
            {step.state === 'done' && <Check size={14} strokeWidth={2.5} />}
            {step.state === 'active' && <Loader2 size={14} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" />}
            {step.state === 'failed' && <XCircle size={14} strokeWidth={2.5} />}
            {step.state === 'pending' && <Circle size={8} className="fill-current text-graphite/30" />}
          </span>
          <div className="min-w-0">
            <p className={cn('text-sm', step.state === 'done' ? 'font-medium text-charcoal' : step.state === 'active' || step.state === 'failed' ? 'font-semibold text-charcoal' : 'text-warmGray')}>{step.label}</p>
            {step.detail && <p className={cn('text-xs', step.state === 'failed' ? 'text-alertRed' : 'text-warmGray')}>{step.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

interface Props {
  data: OnboardingState
  // Rời màn thiết lập (đã xong hoặc bỏ qua)
  onSuccess: () => void
  onRetry: () => void
  // Nơi nút thoát đưa về: danh sách thiết bị, hoặc trang Zone đã mở thiết lập
  leaveLabel?: string
}

export function Step5WaitOnline({ data, onSuccess, onRetry, leaveLabel = 'Về danh sách thiết bị' }: Props) {
  const [now, setNow] = useState(() => Date.now())
  // Sự kiện socket DEVICE_STATUS_CHANGE: báo ngay, không chờ lần đọc lại
  const [socketOnline, setSocketOnline] = useState(false)
  const isCamera = data.deviceType === 'CAMERA_NODE'
  const startedAt = useRef(Date.now())
  const { t: cameraText } = useTranslation(devicesDict)
  const role = useAuthStore(state => state.user?.role)
  const [sourceOpen, setSourceOpen] = useState(false)

  // Thiết bị đã ONLINE từ trước thì socket không còn sự kiện nào: đọc trạng thái từ API
  const { data: sensor } = useSensorNode(isCamera ? undefined : data.deviceDbId, CONFIG_POLL_MS)
  const { data: cameras } = useHouseCameras(isCamera ? data.location.houseId : undefined)
  const camera = isCamera ? cameras?.find(item => item._id === data.deviceDbId) : undefined
  const device = isCamera ? camera : sensor

  // Camera gắn nhà nên nghe ở room house:<houseId>, bộ điều khiển ở room zone:<zoneId>
  useDeviceStatusEvents(
    isCamera ? { houseId: data.location.houseId } : { zoneId: data.location.zoneId },
    data.deviceDbId,
    status => { if (status === 'ONLINE') setSocketOnline(true) },
  )

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const progress = evaluateSetup({
    isCamera, now, startedAt: startedAt.current, socketOnline,
    registeredAt: device?.registered_at,
    status: device?.status,
    lastHeartbeat: device?.last_heartbeat,
    configSync: sensor?.config_sync,
    cameraStatus: camera?.camera_status,
    formatTime: formatDateTime,
  })
  const { verdict, steps } = progress

  const failureIcon = (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-alertRed/10 text-alertRed">
      <AlertTriangle size={30} strokeWidth={1.8} />
    </div>
  )

  if (verdict === 'ready') {
    // Chi tiết kết quả: chỉ những giá trị thiết bị đã báo
    const lastSeen = device?.last_heartbeat
    const facts = [
      lastSeen ? `Lần kết nối cuối lúc ${formatHourMinute(lastSeen)}` : undefined,
      sensor?.firmware_version ? `Firmware ${sensor.firmware_version}` : undefined,
      sensor?.rssi !== undefined && sensor.rssi !== null ? `Sóng Wi-Fi ${sensor.rssi} dBm` : undefined,
    ].filter(Boolean)
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 size={32} strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-charcoal">Thiết bị đã sẵn sàng</h2>
          {facts.length > 0 && <p className="mt-1 text-sm text-warmGray">{facts.join(' · ')}</p>}
        </div>
        <StepList steps={steps} />
        {isCamera && (
          <CameraSourceHelp
            status={camera?.camera_status}
            className="w-full max-w-sm text-left"
            action={canSetCameraSource(role, { type: 'camera' })
              ? <Button variant="secondary" size="sm" className="self-start" onClick={() => setSourceOpen(true)}>{cameraText('help.open')}</Button>
              : undefined}
          />
        )}
        <Button onClick={onSuccess} className="w-full max-w-xs justify-center">{leaveLabel}</Button>
        <CameraSourceModal camera={sourceOpen && camera ? { id: camera._id, deviceId: camera.device_id } : undefined} onClose={() => setSourceOpen(false)} />
      </div>
    )
  }

  if (verdict === 'config-stuck') {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        {failureIcon}
        <div>
          <h2 className="text-lg font-bold text-charcoal">Thiết bị đã kết nối nhưng chưa áp cấu hình của Zone</h2>
          <p className="mt-1 text-sm text-warmGray">
            Wi-Fi và máy chủ không có vấn đề. Hệ thống vẫn gửi lại cấu hình; nếu không khớp, cảnh báo cấu hình chưa khớp sẽ hiện ở trang Cảnh báo. Kiểm tra lại phiên bản firmware của thiết bị.
          </p>
        </div>
        <StepList steps={steps} />
        <Button onClick={onSuccess} className="w-full max-w-xs justify-center">{leaveLabel}</Button>
      </div>
    )
  }

  if (verdict === 'timed-out') {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        {failureIcon}
        <div>
          <h2 className="text-lg font-bold text-charcoal">Chưa nhận được tín hiệu từ thiết bị</h2>
          <p className="mt-1 text-sm text-warmGray">
            Thiết bị đã đăng ký nhưng không gửi tín hiệu nào trong 15 phút. Hệ thống không biết chính xác lý do, vì thiết bị chưa nói chuyện được với máy chủ.
          </p>
        </div>
        <StepList steps={steps} />
        <div className="w-full max-w-sm text-left">
          <p className="text-sm font-semibold text-charcoal">Kiểm tra theo thứ tự</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-warmGray">
            {(isCamera ? CAMERA_CHECKS : SENSOR_CHECKS).map(check => <li key={check}>{check}</li>)}
          </ol>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button onClick={onRetry} className="w-full justify-center">
            <RotateCcw className="h-4 w-4" />
            {isCamera ? 'Thử lại' : 'Nhập lại Wi-Fi'}
          </Button>
          <button onClick={onSuccess} className="text-sm text-warmGray hover:text-charcoal">
            Bỏ qua, {leaveLabel.charAt(0).toLowerCase() + leaveLabel.slice(1)}
          </button>
        </div>
      </div>
    )
  }

  // Đang chờ: vòng đếm ngược 15', chấm "radar" lan ra khi chưa online
  const online = steps[1].state === 'done'
  const ratio = Math.min(1, progress.elapsedMs / SETUP_TIMEOUT_MS)
  const remainMins = Math.floor(progress.remainingMs / 60_000)
  const remainSecs = Math.floor((progress.remainingMs % 60_000) / 1000)
  const heading = online ? (isCamera ? 'Đang kiểm tra camera…' : 'Đang áp cấu hình của Zone…') : 'Đang chờ tín hiệu từ thiết bị…'
  const hint = online
    ? 'Tự động cập nhật khi thiết bị báo xong'
    : 'Chưa biết thiết bị đang kẹt ở đâu cho tới khi nhận được tín hiệu đầu tiên'

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="relative flex h-36 w-36 items-center justify-center">
        {!online && <span aria-hidden className="absolute inset-3 animate-ping-soft rounded-full bg-limeMist motion-reduce:animate-none" />}
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="60" cy="60" r={RING_R} fill="none" strokeWidth="6" className="stroke-graphite/10" />
          <circle
            cx="60" cy="60" r={RING_R} fill="none" strokeWidth="6" strokeLinecap="round"
            className={cn('transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none', online ? 'stroke-success' : 'stroke-charcoal')}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * ratio}
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
        {!isCamera && !online && <p className="mt-1 text-xs text-warmGray">Thiết bị chỉ kết nối được Wi-Fi 2,4 GHz.</p>}
      </div>

      <StepList steps={steps} />
    </div>
  )
}
