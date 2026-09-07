// SwiftletCare utility functions

/** Format date to Vietnamese locale */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

/** Format sensor value with unit */
export const formatSensor = (value: number | undefined, unit: string, decimals = 1) =>
  value !== undefined ? `${value.toFixed(decimals)} ${unit}` : '--'

/** Severity color class */
export const severityClass = (severity: string) => ({
  CRITICAL: 'badge-critical',
  HIGH:     'badge-high',
  MEDIUM:   'badge-medium',
  LOW:      'badge-low',
}[severity] ?? 'badge-low')

/** Format return rate */
export const formatReturnRate = (rate: number) => `${rate.toFixed(1)}%`
