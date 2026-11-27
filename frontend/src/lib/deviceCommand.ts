import { compareVersions } from '@/lib/firmwareFlasher'
import type { DeviceStatus } from '@/types'

// Firmware trước bản này bỏ qua lệnh khởi động lại từ xa (backend trả 501)
export const RESTART_SUPPORT_SINCE = '1.4.0'

// Vì sao chưa khởi động lại từ xa được; null là gửi được. Cùng điều kiện backend kiểm trước khi gửi lệnh
export function restartBlockReason(node: { status: DeviceStatus; firmware_version?: string }): string | null {
  if (node.status !== 'ONLINE') {
    const state = node.status === 'PENDING' ? 'chờ kết nối' : 'mất kết nối'
    return `Thiết bị đang ${state}, chỉ khởi động lại từ xa được khi đang online.`
  }
  if (!node.firmware_version) return 'Thiết bị chưa báo phiên bản firmware nên chưa khởi động lại từ xa được.'
  if (compareVersions(node.firmware_version, RESTART_SUPPORT_SINCE) < 0) {
    return `Firmware v${node.firmware_version} chưa hỗ trợ khởi động lại từ xa, cần từ v${RESTART_SUPPORT_SINCE}.`
  }
  return null
}
