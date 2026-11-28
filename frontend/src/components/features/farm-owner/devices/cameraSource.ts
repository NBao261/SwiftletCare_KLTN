import type { DevicesKey } from '@/constants/devices.i18n'
import type { CameraStatus } from '@/types'

// Địa chỉ camera IP Farm Owner nhập cho nút AI: gợi ý đường dẫn theo hãng, tách địa chỉ RTSP dán vào, kiểm ô (cùng giới hạn backend)

export interface CameraSourceForm {
  host: string
  port: string
  username: string
  password: string
  path: string
}

export const DEFAULT_RTSP_PORT = 554

// Đường dẫn luồng chính của các hãng hay dùng; hãng khác thì xem hướng dẫn của camera
export const CAMERA_PATH_PRESETS: { brand: string; path: string }[] = [
  { brand: 'TP-Link VIGI', path: '/stream1' },
  { brand: 'Hikvision', path: '/Streaming/Channels/101' },
  { brand: 'Dahua, Imou', path: '/cam/realmonitor?channel=1&subtype=0' },
]

const HOST_PATTERN = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/
const PATH_PATTERN = /^\/[^\s]{0,199}$/

// "rtsp://admin:mk@1.2.3.4:554/stream1" → các ô; null khi không phải địa chỉ RTSP
export function parseRtspInput(text: string): CameraSourceForm | null {
  let url: URL
  try {
    url = new URL(text.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'rtsp:' || !url.hostname) return null
  return {
    host: url.hostname,
    port: url.port || String(DEFAULT_RTSP_PORT),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    path: `${url.pathname || '/'}${url.search}`,
  }
}

// Việc nên kiểm khi camera IP chưa có hình, theo tình trạng nút AI báo; chỉ gợi ý, không khẳng định nguyên nhân
export function cameraHelpKeys(status: CameraStatus | null | undefined): DevicesKey[] {
  switch (status) {
    case 'OK': return []
    case 'NO_SOURCE': return ['help.nosource']
    case 'AUTH_FAILED': return ['help.auth1', 'help.auth2']
    case 'UNREACHABLE': return ['help.unreach1', 'help.unreach2', 'help.unreach3']
    case 'NO_FRAMES': return ['help.noframes1', 'help.noframes2']
    default: return ['help.unknown']
  }
}

export type CameraSourceField = keyof CameraSourceForm

// Câu báo theo ô (tiếng Việt, dịch ở nơi hiện); rỗng là hợp lệ
export function validateCameraSource(form: CameraSourceForm): Partial<Record<CameraSourceField, string>> {
  const errors: Partial<Record<CameraSourceField, string>> = {}
  if (!HOST_PATTERN.test(form.host.trim())) errors.host = 'source.errorHost'
  const port = Number(form.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = 'source.errorPort'
  if (form.username.length > 64) errors.username = 'source.errorUsername'
  if (form.password.length > 128) errors.password = 'source.errorPassword'
  if (!PATH_PATTERN.test(form.path.trim())) errors.path = 'source.errorPath'
  return errors
}
