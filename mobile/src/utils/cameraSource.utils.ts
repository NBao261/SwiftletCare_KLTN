import type { CameraSource, CameraStatus, UpdateCameraSourcePayload } from '@/types'
import { t } from '@/utils/i18n.utils'

// Địa chỉ camera IP Farm Owner nhập cho camera đếm chim (FARM-FR-004b): gợi ý đường dẫn theo hãng, tách địa chỉ RTSP dán vào,
// kiểm từng ô cùng giới hạn backend — cùng cách làm của web (frontend/.../devices/cameraSource.ts)

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

// Form trống của camera chưa có địa chỉ: tài khoản admin và đường dẫn của hãng đầu như web
export const EMPTY_CAMERA_SOURCE_FORM: CameraSourceForm = {
  host: '',
  port: String(DEFAULT_RTSP_PORT),
  username: 'admin',
  password: '',
  path: CAMERA_PATH_PRESETS[0].path,
}

const HOST_PATTERN =
  /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/
const PATH_PATTERN = /^\/\S{0,199}$/
// rtsp://[tài khoản[:mật khẩu]@]địa chỉ[:cổng][/đường dẫn?query]; phần tài khoản lấy tới dấu @ cuối như URL của web
const RTSP_PATTERN = /^rtsp:\/\/(?:(.*)@)?([^@:/?#\s]+)(?::(\d{1,5}))?(\/\S*)?$/i
const USERNAME_MAX_LENGTH = 64
const PASSWORD_MAX_LENGTH = 128
const PORT_MAX = 65535

// Giải mã %xx trong tài khoản, mật khẩu; chuỗi mã hoá sai thì giữ nguyên
function decodePart(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

// Form của camera đã có địa chỉ: điền lại các ô đã lưu, mật khẩu để trống (không bao giờ hiện lại)
export function toCameraSourceForm(source: CameraSource | null): CameraSourceForm {
  if (!source) return EMPTY_CAMERA_SOURCE_FORM
  return { host: source.host, port: String(source.port), username: source.username, password: '', path: source.path }
}

// "rtsp://<tài khoản>:<mật khẩu>@<IP>:554/stream1" → các ô; không phải địa chỉ RTSP thì null
export function parseRtspInput(text: string): CameraSourceForm | null {
  const match = RTSP_PATTERN.exec(text.trim())
  if (!match) return null
  const [, userInfo = '', host, port, path] = match
  const separator = userInfo.indexOf(':')
  return {
    host,
    port: port ?? String(DEFAULT_RTSP_PORT),
    username: decodePart(separator === -1 ? userInfo : userInfo.slice(0, separator)),
    password: separator === -1 ? '' : decodePart(userInfo.slice(separator + 1)),
    path: path ?? '/',
  }
}

export type CameraSourceField = keyof CameraSourceForm

// Câu lỗi theo ô; ô không có trong kết quả là hợp lệ
export function validateCameraSource(form: CameraSourceForm): Partial<Record<CameraSourceField, string>> {
  const errors: Partial<Record<CameraSourceField, string>> = {}
  if (!HOST_PATTERN.test(form.host.trim())) errors.host = t('Nhập IP hoặc tên miền, không kèm rtsp:// hay cổng')
  const port = Number(form.port)
  if (!Number.isInteger(port) || port < 1 || port > PORT_MAX) errors.port = t('Cổng từ 1 đến 65535')
  if (form.username.length > USERNAME_MAX_LENGTH) errors.username = t('Tài khoản tối đa 64 ký tự')
  if (form.password.length > PASSWORD_MAX_LENGTH) errors.password = t('Mật khẩu tối đa 128 ký tự')
  if (!PATH_PATTERN.test(form.path.trim())) errors.path = t('Đường dẫn bắt đầu bằng /, không có khoảng trắng')
  return errors
}

// Thân gửi backend: ô mật khẩu trống mà đã có mật khẩu lưu thì không gửi (giữ mật khẩu cũ); chưa có thì gửi chuỗi rỗng
export function buildCameraSourcePayload(form: CameraSourceForm, hasSavedPassword: boolean): UpdateCameraSourcePayload {
  return {
    host: form.host.trim(),
    port: Number(form.port),
    username: form.username,
    path: form.path.trim(),
    ...(form.password || !hasSavedPassword ? { password: form.password } : {}),
  }
}

// Tình trạng camera có vấn đề cần người dùng xử lý (sai mật khẩu, không kết nối được, không có hình): hiện màu cam
export function isCameraStatusProblem(status: CameraStatus | null | undefined): boolean {
  return status === 'AUTH_FAILED' || status === 'UNREACHABLE' || status === 'NO_FRAMES'
}
