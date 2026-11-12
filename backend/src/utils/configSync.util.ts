import type { ConfigSyncState } from '@/types'

/** BR-24 — số heartbeat liên tiếp vẫn báo phiên bản cũ thì là `CONFIG_MISMATCH` (Report 3 §4.5) */
export const CONFIG_MISMATCH_HEARTBEATS = 3

/**
 * ENV-FR-027 — phiên bản cấu hình là giây Unix, luôn lớn hơn bản trước của chính Zone đó
 * (deviceConfig.service#publishZoneConfig). Nếu đếm 1, 2, 3… thì hai Zone rất dễ cùng số, và
 * controller dời từ Zone này sang Zone kia (FARM-FR-007b) sẽ bị coi là đã áp cấu hình mới chỉ vì trùng số.
 * ponytail: hai Zone đổi trong cùng một giây vẫn có thể trùng số; dời thiết bị tăng phiên bản Zone
 * đích nên chỉ lệch khi Zone nguồn cũng đổi đúng giây đó. Cần chắc tuyệt đối thì dùng bộ đếm toàn cục.
 */
export const currentConfigVersion = (now = Date.now()): number => Math.floor(now / 1000)

export interface ConfigSync {
  state: ConfigSyncState
  /** null = firmware không báo phiên bản */
  applied: number | null
  stale: number
}

/**
 * Report 3 §6.12 (SM-12) — trạng thái sau một heartbeat. Heartbeat không có `appliedConfigVersion`
 * là firmware trước 2.1.0: `UNKNOWN`, không cảnh báo. Báo đúng phiên bản của Zone: `APPLIED`. Báo
 * phiên bản khác: `PENDING`, rồi `MISMATCH` từ heartbeat thứ `CONFIG_MISMATCH_HEARTBEATS`.
 */
export function syncAfterHeartbeat(prev: { stale: number }, reported: unknown, zoneVersion: number): ConfigSync {
  if (typeof reported !== 'number' || !Number.isInteger(reported) || reported < 0) {
    return { state: 'UNKNOWN', applied: null, stale: 0 }
  }
  if (reported === zoneVersion) return { state: 'APPLIED', applied: reported, stale: 0 }
  const stale = prev.stale + 1
  return { state: stale >= CONFIG_MISMATCH_HEARTBEATS ? 'MISMATCH' : 'PENDING', applied: reported, stale }
}
