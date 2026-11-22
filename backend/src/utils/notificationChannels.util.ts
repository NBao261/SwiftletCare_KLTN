import type { AlertSeverity, NotificationPreferences } from '@/types'

// Push mặc định tắt; Telegram mặc định bật (chỉ gửi được khi đã liên kết)
export function channelEnabled(prefs: NotificationPreferences | undefined, severity: AlertSeverity, channel: 'push' | 'telegram'): boolean {
  const chosen = prefs?.by_severity?.[severity]?.[channel] ?? prefs?.[channel]
  return channel === 'push' ? !!chosen : chosen !== false
}

// CRITICAL luôn tới ít nhất 1 kênh ngoài ứng dụng; Telegram chưa liên kết thì không tính
export function criticalHasOutsideChannel(prefs: NotificationPreferences | undefined, telegramLinked: boolean): boolean {
  return channelEnabled(prefs, 'CRITICAL', 'push') || (telegramLinked && channelEnabled(prefs, 'CRITICAL', 'telegram'))
}
