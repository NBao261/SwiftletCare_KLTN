import type { AlertSeverity, ChannelChoice, NotificationPreferences } from '@/types'
import { getLevelSeverity, getSeverityLevel, SEVERITY_LEVELS, type SeverityLevel } from '@/utils/severity.utils'

// Kênh ngoài app theo mức cảnh báo (ALERT-FR-005): 4 cấp giao diện ↔ by_severity 4 mức của backend, một cấp một mức, cùng cách
// tính với web (frontend/src/validations/common/notificationChannels.validation.ts)

export type LevelChannels = ChannelChoice

const SEVERITIES: readonly AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

// Kênh chung: push và Telegram mặc định bật như model User của backend
export function getGeneralChannels(preferences: NotificationPreferences | undefined): LevelChannels {
  return { push: preferences?.push ?? true, telegram: preferences?.telegram ?? true }
}

// Kênh đang dùng của mỗi cấp: ghi đè của mức backend tương ứng, không có thì theo kênh chung
export function getLevelChannels(preferences: NotificationPreferences | undefined): Record<SeverityLevel, LevelChannels> {
  const general = getGeneralChannels(preferences)
  const result = {} as Record<SeverityLevel, LevelChannels>
  for (const level of SEVERITY_LEVELS) {
    const choice = preferences?.by_severity?.[getLevelSeverity(level)]
    result[level] = { push: choice?.push ?? general.push, telegram: choice?.telegram ?? general.telegram }
  }
  return result
}

// Đổi công tắc Push chung thì mọi cấp theo cùng giá trị, để khi lưu không còn ghi đè nào giữ giá trị cũ
export function applyGeneralPush(
  levels: Record<SeverityLevel, LevelChannels>,
  push: boolean,
): Record<SeverityLevel, LevelChannels> {
  const result = {} as Record<SeverityLevel, LevelChannels>
  for (const level of SEVERITY_LEVELS) result[level] = { ...levels[level], push }
  return result
}

// by_severity gửi lên: mức giống kênh chung thì null (bỏ ghi đè), khác thì ghi đè cả 2 kênh
export function buildBySeverityPayload(
  levels: Record<SeverityLevel, LevelChannels>,
  general: LevelChannels,
): Record<AlertSeverity, ChannelChoice | null> {
  const result = {} as Record<AlertSeverity, ChannelChoice | null>
  for (const severity of SEVERITIES) {
    const choice = levels[getSeverityLevel(severity)]
    result[severity] = choice.push === general.push && choice.telegram === general.telegram ? null : { ...choice }
  }
  return result
}

// Cấp Khẩn cấp phải còn ít nhất một kênh ngoài app (ALERT-FR-005); Telegram chỉ tính khi đã liên kết bot
export function urgentHasOutsideChannel(urgent: LevelChannels, telegramLinked: boolean): boolean {
  return urgent.push || (telegramLinked && urgent.telegram)
}
