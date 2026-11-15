import type { AlertSeverity, NotificationPreferences } from '@/types'

/**
 * ALERT-FR-005 — kênh của 1 mức cảnh báo: ghi đè theo mức (`by_severity`) nếu có, không thì cài đặt chung. Push mặc
 * định tắt cho tới khi bật; Telegram mặc định bật (chỉ gửi được khi đã liên kết).
 */
export function channelEnabled(prefs: NotificationPreferences | undefined, severity: AlertSeverity, channel: 'push' | 'telegram'): boolean {
  const chosen = prefs?.by_severity?.[severity]?.[channel] ?? prefs?.[channel]
  return channel === 'push' ? !!chosen : chosen !== false
}

/**
 * ALERT-FR-005, SF-04 — cảnh báo CRITICAL luôn tới ít nhất 1 kênh ngoài ứng dụng: push bật, hoặc Telegram bật VÀ đã
 * liên kết (chưa liên kết thì không gửi được nên không tính).
 */
export function criticalHasOutsideChannel(prefs: NotificationPreferences | undefined, telegramLinked: boolean): boolean {
  return channelEnabled(prefs, 'CRITICAL', 'push') || (telegramLinked && channelEnabled(prefs, 'CRITICAL', 'telegram'))
}
