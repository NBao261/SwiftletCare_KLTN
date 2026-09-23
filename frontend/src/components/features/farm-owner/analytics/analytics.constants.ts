import { format, parseISO } from 'date-fns'
import type { AnalyticsRange } from '@/apis/farm-owner/analytics.api'

export const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '1h', label: '1 giờ' }, { value: '6h', label: '6 giờ' }, { value: '24h', label: '24 giờ' },
  { value: '7d', label: '7 ngày' }, { value: '30d', label: '30 ngày' },
]

export const METRICS = [
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C' },
  { key: 'humidity', label: 'Độ ẩm', unit: '%' },
  { key: 'light_lux', label: 'Ánh sáng', unit: 'lux' },
  { key: 'nh3_ppm', label: 'NH3', unit: 'ppm' },
  { key: 'co2_ppm', label: 'CO2', unit: 'ppm' },
  { key: 'sound_db', label: 'Âm thanh', unit: 'dB' },
] as const
export type MetricKey = typeof METRICS[number]['key']

export function labelForRange(iso: string, range: AnalyticsRange): string {
  const date = parseISO(iso)
  return range === '7d' || range === '30d' ? format(date, 'dd/MM') : format(date, 'HH:mm')
}

export const xAxisTicks = { autoSkip: true, maxRotation: 0, maxTicksLimit: 8 }

/**
 * Hệ số tương quan Pearson (r) giữa 2 chuỗi cùng độ dài — dùng cho
 * CorrelationCard (độ ẩm × return rate, ANALYTICS-FR-003). Trả `null` nếu
 * không đủ điểm dữ liệu hoặc 1 trong 2 chuỗi không có phương sai (chia cho 0).
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return null
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let cov = 0, varX = 0, varY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }
  if (varX === 0 || varY === 0) return null
  return cov / Math.sqrt(varX * varY)
}
