import type { CameraStatus, DeviceStatus } from '@/types'

// Bước chờ cuối của thiết lập: chỉ nói những gì hệ thống thật sự biết (đã đăng ký, đã nhận tín hiệu, đã áp cấu hình, camera báo gì)
export const SETUP_TIMEOUT_MS = 15 * 60 * 1000

export type StepState = 'done' | 'active' | 'pending' | 'failed'

export interface ProgressStep {
  id: 'registered' | 'signal' | 'config' | 'video'
  label: string
  state: StepState
  // Thời điểm hoặc lý do cụ thể
  detail?: string
}

export type SetupVerdict = 'waiting' | 'ready' | 'config-stuck' | 'timed-out'

export interface SetupInput {
  isCamera: boolean
  now: number
  // Mốc đăng ký; chưa có thì tính từ lúc mở màn
  registeredAt?: string
  startedAt: number
  status?: DeviceStatus
  // Sự kiện socket báo ONLINE trước lần đọc lại
  socketOnline: boolean
  lastHeartbeat?: string
  configSync?: 'PENDING' | 'APPLIED' | 'MISMATCH' | 'UNKNOWN'
  cameraStatus?: CameraStatus | null
  formatTime: (iso: string) => string
}

export interface SetupProgress {
  verdict: SetupVerdict
  steps: ProgressStep[]
  elapsedMs: number
  remainingMs: number
}

// Lý do camera IP chưa có hình do nút AI báo; chưa nhập địa chỉ là việc của chủ nhà yến, không phải lỗi
const VIDEO_DETAIL: Record<CameraStatus, string> = {
  OK: 'Đang nhận hình',
  NO_SOURCE: 'Chưa nhập địa chỉ camera. Chủ nhà yến nhập ở trang chi tiết thiết bị',
  AUTH_FAILED: 'Sai tài khoản hoặc mật khẩu camera',
  UNREACHABLE: 'Không kết nối được camera',
  NO_FRAMES: 'Kết nối được nhưng không có hình',
}

export function evaluateSetup(input: SetupInput): SetupProgress {
  const { isCamera, now, registeredAt, startedAt, formatTime } = input
  const start = registeredAt ? new Date(registeredAt).getTime() : startedAt
  const elapsedMs = Math.max(0, now - start)
  const remainingMs = Math.max(0, SETUP_TIMEOUT_MS - elapsedMs)
  const timedOut = elapsedMs > SETUP_TIMEOUT_MS

  const online = input.socketOnline || input.status === 'ONLINE'
  // UNKNOWN: firmware trước 2.1.0 không báo phiên bản cấu hình, coi như xong
  const configApplied = input.configSync === 'APPLIED' || input.configSync === 'UNKNOWN'
  const configMismatch = input.configSync === 'MISMATCH'

  let verdict: SetupVerdict = 'waiting'
  if (online && (isCamera || configApplied)) verdict = 'ready'
  else if (!isCamera && online && (configMismatch || timedOut)) verdict = 'config-stuck'
  else if (!online && timedOut) verdict = 'timed-out'

  const registered: ProgressStep = {
    id: 'registered', label: 'Đã đăng ký thiết bị', state: 'done',
    detail: registeredAt ? `Lúc ${formatTime(registeredAt)}` : undefined,
  }

  let signalState: StepState = 'active'
  let signalDetail = 'Chưa nhận được tín hiệu nào từ thiết bị'
  if (online) {
    signalState = 'done'
    const lastSeen = input.lastHeartbeat
    signalDetail = lastSeen ? `Lần kết nối cuối lúc ${formatTime(lastSeen)}` : 'Đã có tín hiệu'
  } else if (timedOut) {
    signalState = 'failed'
    signalDetail = 'Không nhận được tín hiệu nào trong 15 phút'
  }
  const signal: ProgressStep = { id: 'signal', label: isCamera ? 'Camera đếm chim kết nối máy chủ' : 'Thiết bị kết nối máy chủ', state: signalState, detail: signalDetail }

  if (isCamera) {
    const status = input.cameraStatus ?? undefined
    let videoState: StepState = 'pending'
    let videoDetail: string | undefined
    if (online && status === 'OK') videoState = 'done'
    else if (online && status && status !== 'NO_SOURCE') videoState = 'failed'
    if (online) videoDetail = status ? VIDEO_DETAIL[status] : 'Camera đếm chim chưa báo tình trạng camera IP'
    return { verdict, steps: [registered, signal, { id: 'video', label: 'Camera IP có hình', state: videoState, detail: videoDetail }], elapsedMs, remainingMs }
  }

  let configState: StepState = 'pending'
  let configDetail: string | undefined
  if (online) {
    if (configApplied) {
      configState = 'done'
      configDetail = input.configSync === 'UNKNOWN' ? 'Firmware cũ không báo phiên bản cấu hình nên chưa xác nhận được' : undefined
    } else if (configMismatch || timedOut) {
      configState = 'failed'
      configDetail = 'Thiết bị báo phiên bản cấu hình khác với của Zone'
    } else {
      configState = 'active'
      configDetail = 'Chờ thiết bị báo đã áp cấu hình'
    }
  }
  return { verdict, steps: [registered, signal, { id: 'config', label: 'Áp cấu hình của Zone', state: configState, detail: configDetail }], elapsedMs, remainingMs }
}
