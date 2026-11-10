import type { Href } from 'expo-router'

// Màn mở từ lối tắt nhận param returnTo = đường dẫn màn gốc, để hiện nút ‹ quay về đúng chỗ (MOBILE_GUIDE §2.3).
// Chỉ nhận đường dẫn trong app: tab hoặc chi tiết cảnh báo — không nhận link ngoài hay chuỗi lạ từ deep link
const RETURN_PREFIXES = ['/(tabs)/', '/alert/'] as const

// Đường dẫn màn gốc hay dùng
export const RETURN_TO_HOME = '/(tabs)/home'
export const RETURN_TO_FARMS = '/(tabs)/farms'
export const RETURN_TO_ANALYTICS = '/(tabs)/analytics'
export const RETURN_TO_ALERTS = '/(tabs)/alerts'
export const RETURN_TO_PROFILE = '/(tabs)/profile'
export const RETURN_TO_NOTIFICATIONS = '/(tabs)/profile/notifications'

// Màn một nhà: '/(tabs)/farms/<houseId>'
export function buildHouseReturnTo(houseId: string): string {
  return `/(tabs)/farms/${encodeURIComponent(houseId)}`
}

// Chi tiết một cảnh báo: '/alert/<alertId>'
export function buildAlertReturnTo(alertId: string): string {
  return `/alert/${encodeURIComponent(alertId)}`
}

// returnTo có dùng được không: chuỗi bắt đầu bằng một tiền tố trong app, không có "..", "//" hay phần query
export function isSafeReturnTo(value: unknown): value is Href & string {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value.includes('..') || value.includes('//') || value.includes('?') || value.includes('://')) return false
  return RETURN_PREFIXES.some(prefix => value.startsWith(prefix))
}
