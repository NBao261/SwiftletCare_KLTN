// SwiftletCare utility functions

/** Format date to Vietnamese locale */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

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
