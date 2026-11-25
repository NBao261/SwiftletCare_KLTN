// Địa chỉ RTSP của camera IP: các ô Farm Owner nhập trên web ↔ URL nút AI mở

export interface CameraSourceFields {
  host: string
  port: number
  username: string
  path: string
}

export const DEFAULT_RTSP_PORT = 554
// IPv4 hoặc tên miền, không có scheme, cổng hay đường dẫn
export const CAMERA_HOST_PATTERN = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/
// Bắt đầu bằng "/", không khoảng trắng; có thể có query (VD Hikvision "?transportmode=unicast")
export const CAMERA_PATH_PATTERN = /^\/[^\s]{0,199}$/

// Tài khoản và mật khẩu có ký tự đặc biệt (@, :, /) phải mã hoá, không thì URL hỏng
export function buildRtspUrl(fields: CameraSourceFields, password: string | null): string {
  const user = encodeURIComponent(fields.username)
  const credentials = fields.username ? `${user}${password ? `:${encodeURIComponent(password)}` : ''}@` : ''
  return `rtsp://${credentials}${fields.host}:${fields.port}${fields.path}`
}

// URL cũ lưu chữ thường (rtsp_url) → các ô + mật khẩu; null khi không phải RTSP
export function parseRtspUrl(url: string): (CameraSourceFields & { password: string | null }) | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'rtsp:' || !parsed.hostname) return null
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : DEFAULT_RTSP_PORT,
    username: decodeURIComponent(parsed.username),
    path: `${parsed.pathname || '/'}${parsed.search}`,
    password: parsed.password ? decodeURIComponent(parsed.password) : null,
  }
}
