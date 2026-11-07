import { OVERRIDE_MAX_MS, OVERRIDE_MIN_MS, PUMP_ON_MAX_MS } from '@/constants/relayOverride'
import type { RelayName, SensorNode } from '@/types'
import { t } from '@/utils/i18n.utils'

const MINUTE_MS = 60 * 1000
const MINUTES_PER_HOUR = 60

// Thời gian còn lại tới giờ hết hạn override: "còn 18 phút", "còn 2 giờ 5 phút", "còn dưới 1 phút"; đã hết thì null
export function formatRemainingTime(expiresAt: string, now: number = Date.now()): string | null {
  const remainingMs = new Date(expiresAt).getTime() - now
  if (remainingMs <= 0) return null
  const totalMinutes = Math.floor(remainingMs / MINUTE_MS)
  if (totalMinutes < 1) return t('còn dưới 1 phút')
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR
  if (hours === 0) return t('còn {minutes} phút', { minutes })
  return minutes === 0 ? t('còn {hours} giờ', { hours }) : t('còn {hours} giờ {minutes} phút', { hours, minutes })
}

const VIETNAM_OFFSET_MS = 7 * 60 * MINUTE_MS

export interface DurationLimits {
  minMs: number
  maxMs: number
}

// Khoảng thời lượng điều khiển tay theo BR-08: bật bơm tối đa 30 phút, còn lại tối đa 24 giờ
export function getOverrideDurationLimits(relay: RelayName, state: boolean): DurationLimits {
  const isPumpOn = relay === 'misting' && state
  return { minMs: OVERRIDE_MIN_MS, maxMs: isPumpOn ? PUMP_ON_MAX_MS : OVERRIDE_MAX_MS }
}

// Kẹp thời lượng vào khoảng cho phép — ví dụ đổi từ tắt sang bật bơm khi đang chọn 1 giờ thì về 30 phút
export function clampOverrideDuration(durationMs: number, limits: DurationLimits): number {
  return Math.min(limits.maxMs, Math.max(limits.minMs, durationMs))
}

// Thời lượng ngắn gọn cho nút chọn: "5 phút", "1 giờ", "1 giờ 30 phút"
export function formatDuration(durationMs: number): string {
  const totalMinutes = Math.round(durationMs / MINUTE_MS)
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR
  if (hours === 0) return t('{minutes} phút', { minutes })
  return minutes === 0 ? t('{hours} giờ', { hours }) : t('{hours} giờ {minutes} phút', { hours, minutes })
}

// Giờ:phút theo giờ Việt Nam của một thời điểm ("14:05") — giờ tự về AUTO
export function formatClockTime(isoDate: string): string {
  return new Date(new Date(isoDate).getTime() + VIETNAM_OFFSET_MS).toISOString().slice(11, 16)
}

// Số controller đang điều khiển tay — backend giữ một hạn chung cho cả controller nên đếm theo controller
export function countManualControllers(nodes: SensorNode[]): number {
  return nodes.filter(node => node.control_mode === 'MANUAL').length
}

// Khung giờ phát loa: "05:00–07:00 · 17:00–19:00"; tắt lịch hoặc chưa có thì null
export function formatSpeakerWindows(schedule: SensorNode['speaker_schedule']): string | null {
  if (!schedule || schedule.enabled === false || !schedule.windows?.length) return null
  return schedule.windows.map(window => `${window.start}–${window.end}`).join(' · ')
}
