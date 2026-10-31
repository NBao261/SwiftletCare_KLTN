import type { BirdCountDay, DeviceStatus } from '@/types'
import { getCurrentLanguage, t } from '@/utils/i18n.utils'

const CAMERA_STATUS_BADGES: Record<DeviceStatus, string> = {
  ONLINE: 'LIVE',
  OFFLINE: 'MẤT KẾT NỐI',
  PENDING: 'CHỜ KẾT NỐI',
}

// Chữ nhãn trạng thái trên ảnh xem trước của camera
export function getCameraStatusBadge(status: DeviceStatus): string {
  return t(CAMERA_STATUS_BADGES[status])
}

// Số nguyên có dấu ngăn hàng nghìn theo ngôn ngữ: tiếng Việt "2.450", tiếng Anh "2,450"
function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, getCurrentLanguage() === 'en' ? ',' : '.')
}

// Dòng trạng thái của thẻ camera: có phiên chiều thì số chim về, mới có phiên sáng thì số chim ra
export function getCameraCountSummary(day: BirdCountDay | undefined): string {
  if (day?.has_evening) return t('{count} chim về', { count: formatCount(day.net_entry) })
  if (day?.has_morning) return t('{count} chim ra', { count: formatCount(day.net_exit) })
  return t('Chưa có số đếm hôm nay')
}

// Hai dòng số đếm trên video: chim ra (phiên sáng, ròng) và chim vào (phiên chiều, ròng); phiên chưa có thì "_"
export function formatBirdCountRows(day: BirdCountDay | undefined): { exitText: string; entryText: string } {
  return {
    exitText: t('Chim ra: {count}', { count: day?.has_morning ? formatCount(day.net_exit) : '_' }),
    entryText: t('Chim vào: {count}', { count: day?.has_evening ? formatCount(day.net_entry) : '_' }),
  }
}

// Địa chỉ HLS của một stream trên MediaMTX, kèm token xem (VISION-FR-013)
export function buildHlsUrl(baseUrl: string, path: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${path}/index.m3u8?token=${encodeURIComponent(token)}`
}
