// SwiftletCare utility functions

/** Format date to Vietnamese locale */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

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
