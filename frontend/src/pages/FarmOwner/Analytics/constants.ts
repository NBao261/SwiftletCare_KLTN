import { format, parseISO } from 'date-fns'
import type { AnalyticsRange, EnvSummaryPoint } from '@/services/api/analytics'

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

export const TABS = ['env', 'compare', 'bird'] as const
export type Tab = typeof TABS[number]
export const TAB_LABEL: Record<Tab, string> = { env: 'Môi trường', compare: 'So sánh Zone', bird: 'Đàn chim' }

export function labelForRange(iso: string, range: AnalyticsRange): string {
  const date = parseISO(iso)
  return range === '7d' || range === '30d' ? format(date, 'dd/MM') : format(date, 'HH:mm')
}

export function seriesStats(series: EnvSummaryPoint[], key: MetricKey): { min: number; max: number; avg: number } | null {
  const values = series.map(p => p[key]).filter((v): v is number => typeof v === 'number')
  if (values.length === 0) return null
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
  }
}

export const xAxisTicks = { autoSkip: true, maxRotation: 0, maxTicksLimit: 8 }
