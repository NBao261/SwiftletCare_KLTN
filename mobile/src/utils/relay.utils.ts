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
