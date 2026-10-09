// SwiftletCare utility functions

/** Format date to Vietnamese locale */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

/** Chỉ phần ngày/giờ riêng — dùng cho ô bảng 2 tầng (ngày đậm phía trên, giờ xám phía dưới) */
export const formatDateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
export const formatTimeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

const RELATIVE = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })
const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60], ['minute', 60], ['hour', 24], ['day', 7], ['week', 4.35], ['month', 12], ['year', Infinity],
]

/** "5 phút trước", "hôm qua"... — tính theo đồng hồ máy người dùng */
export function formatRelativeTime(iso: string, now = Date.now()) {
  let value = (new Date(iso).getTime() - now) / 1000
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(value) < size) return RELATIVE.format(Math.round(value), unit)
    value /= size
  }
  return formatDate(iso)
}

/**
 * Độ dài 1 khoảng thời gian, chính xác tới phút, lấy 2 đơn vị lớn nhất cho dễ đọc:
 * "45 phút", "3 giờ 20 phút", "1 ngày 4 giờ". Bỏ dấu (dùng cho cả "còn …" lẫn "quá hạn …").
 */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.abs(ms) / 60_000)
  if (minutes < 1) return 'dưới 1 phút'
  const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60
  if (d > 0) return h ? `${d} ngày ${h} giờ` : `${d} ngày`
  if (h > 0) return m ? `${h} giờ ${m} phút` : `${h} giờ`
  return `${m} phút`
}

/** Format sensor value with unit */
export const formatSensor = (value: number | undefined, unit: string, decimals = 1) =>
  value !== undefined ? `${value.toFixed(decimals)} ${unit}` : '--'

/** Format return rate */
export const formatReturnRate = (rate: number) => `${rate.toFixed(1)}%`

/**
 * Lấy message lỗi từ response envelope chuẩn `{success:false, error:{code,message}}`
 * (axios error) — DRY hoá pattern lặp lại ở mọi form gọi API.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
  return message ?? fallback
}

/** ISO (UTC) → giá trị cho input datetime-local theo giờ máy người dùng */
export function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
