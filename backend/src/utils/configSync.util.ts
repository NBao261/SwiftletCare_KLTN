import type { ConfigSyncState } from '@/types'

/** BR-24 */
export const CONFIG_MISMATCH_HEARTBEATS = 3

/** Giây Unix: đếm 1, 2, 3 thì hai Zone dễ trùng số khi dời thiết bị. ponytail: đổi cùng giây vẫn có thể trùng */
export const currentConfigVersion = (now = Date.now()): number => Math.floor(now / 1000)

export interface ConfigSync {
  state: ConfigSyncState
  /** null = firmware không báo */
  applied: number | null
  stale: number
}

/** SM-12: không có appliedConfigVersion là UNKNOWN; lệch đủ CONFIG_MISMATCH_HEARTBEATS là MISMATCH */
export function syncAfterHeartbeat(prev: { stale: number }, reported: unknown, zoneVersion: number): ConfigSync {
  if (typeof reported !== 'number' || !Number.isInteger(reported) || reported < 0) {
    return { state: 'UNKNOWN', applied: null, stale: 0 }
  }
  if (reported === zoneVersion) return { state: 'APPLIED', applied: reported, stale: 0 }
  const stale = prev.stale + 1
  return { state: stale >= CONFIG_MISMATCH_HEARTBEATS ? 'MISMATCH' : 'PENDING', applied: reported, stale }
}
