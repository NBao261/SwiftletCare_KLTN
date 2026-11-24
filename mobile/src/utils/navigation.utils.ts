import type { Href } from 'expo-router'

// Màn mở từ lối tắt nhận param returnTo = đường dẫn màn gốc, để hiện nút ‹ quay về đúng chỗ (MOBILE_GUIDE §2.3).
// Chỉ nhận đường dẫn trong app: tab, chi tiết cảnh báo hoặc chuông — không nhận link ngoài hay chuỗi lạ từ deep link
const RETURN_PREFIXES = ['/(tabs)/', '/alert/', '/notifications'] as const

// Đường dẫn màn gốc hay dùng
export const RETURN_TO_HOME = '/(tabs)/home'
export const RETURN_TO_FARMS = '/(tabs)/farms'
export const RETURN_TO_ANALYTICS = '/(tabs)/analytics'
export const RETURN_TO_ALERTS = '/(tabs)/alerts'
export const RETURN_TO_PROFILE = '/(tabs)/profile'
// Chuông: màn riêng ở stack gốc, ngoài các tab
export const RETURN_TO_NOTIFICATIONS = '/notifications'

// Màn một nhà: '/(tabs)/farms/<houseId>'
export function buildHouseReturnTo(houseId: string): string {
  return `/(tabs)/farms/${encodeURIComponent(houseId)}`
}

// Chi tiết một cảnh báo: '/alert/<alertId>'
export function buildAlertReturnTo(alertId: string): string {
  return `/alert/${encodeURIComponent(alertId)}`
}

// returnTo là màn của stack gốc (chi tiết cảnh báo, chuông), không phải màn trong tab: quay về bằng cách gỡ các màn phía trên
// cho tới màn đó (màn mở tab từ stack gốc đã chồng thêm một bản tab), không mở thêm một bản mới của màn đó
export function isRootStackReturnTo(returnTo: string): boolean {
  return !returnTo.startsWith('/(tabs)/')
}

// Một màn trong stack và trạng thái stack, đủ để xem màn ngay dưới màn hiện tại
interface StackRoute {
  name: string
  params?: object
}
interface StackState {
  index: number
  routes: readonly StackRoute[]
}

// Màn ngay dưới màn hiện tại có đúng route và đủ các tham số này không (vd. chi tiết phiếu → cảnh báo gốc → lại phiếu đó):
// đúng thì nên quay lại thay vì mở chồng thêm, để stack không dài mãi khi đi qua đi lại giữa hai màn
export function isPreviousRoute(state: StackState | undefined, name: string, params: Record<string, string>): boolean {
  const previous = state ? state.routes[state.index - 1] : undefined
  if (previous?.name !== name) return false
  const previousParams = (previous.params ?? {}) as Record<string, unknown>
  return Object.entries(params).every(([key, value]) => previousParams[key] === value)
}

// returnTo có dùng được không: chuỗi bắt đầu bằng một tiền tố trong app, không có "..", "//" hay phần query
export function isSafeReturnTo(value: unknown): value is Href & string {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value.includes('..') || value.includes('//') || value.includes('?') || value.includes('://')) return false
  return RETURN_PREFIXES.some(prefix => value.startsWith(prefix))
}
