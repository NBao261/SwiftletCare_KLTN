import { compareVersions } from '@/lib/firmwareFlasher'
import type { DeviceStatus } from '@/types'

// Firmware trước bản này bỏ qua lệnh khởi động lại từ xa (backend trả 501); cùng ngưỡng với
// COMMAND_SUPPORT_SINCE trong backend/src/utils/firmwareImage.util.ts, đổi bên đó thì đổi cả đây
export const RESTART_SUPPORT_SINCE = '1.4.0'

// Vì sao chưa khởi động lại từ xa được
export type RestartBlockCode = 'offline' | 'pending' | 'noVersion' | 'oldFirmware'

// Nơi gọi tự dịch từng mã (hai hệ dịch khác nhau); oldFirmware kèm phiên bản đang chạy và phiên bản tối thiểu
export type RestartBlockSay = (code: RestartBlockCode, params: { version: string; min: string }) => string

// Cùng điều kiện backend kiểm trước khi gửi lệnh: đang online và firmware từ 1.4.0. null là gửi được
export function restartBlockCode(node: { status: DeviceStatus; firmware_version?: string }): RestartBlockCode | null {
  if (node.status === 'PENDING') return 'pending'
  if (node.status !== 'ONLINE') return 'offline'
  if (!node.firmware_version) return 'noVersion'
  // Không đúng dạng x.y.z (VD 1.4.0-rc1) coi như chưa hỗ trợ, giống versionAtLeast của backend
  const supported = /^\d+\.\d+\.\d+$/.test(node.firmware_version) && compareVersions(node.firmware_version, RESTART_SUPPORT_SINCE) >= 0
  return supported ? null : 'oldFirmware'
}

export function restartBlockReason(node: { status: DeviceStatus; firmware_version?: string }, say: RestartBlockSay): string | null {
  const code = restartBlockCode(node)
  return code ? say(code, { version: node.firmware_version ?? '', min: RESTART_SUPPORT_SINCE }) : null
}
