import type { TelemetryRecord, Thresholds } from '@/types'

// Chỉ số có ngưỡng trong Zone (ENV-FR-007) — NH3/CO2 chỉ để cảnh báo, không điều khiển quạt
export type ThresholdMetric = 'temperature' | 'humidity' | 'light' | 'nh3' | 'co2'

// Số đo cũ hơn khoảng này không còn tính là "đang vượt ngưỡng" — cùng mốc backend tự đóng THRESHOLD_BREACH
// (THRESHOLD_CLEAR_MS trong backend/src/services/alert.service.ts)
const THRESHOLD_READING_MAX_AGE_MS = 5 * 60 * 1000

// Bản ghi còn mới để so ngưỡng; thiết bị ngừng gửi thì số cuối cùng không phản ánh hiện tại
export function isRecentReading(record: TelemetryRecord, now: number = Date.now()): boolean {
  return now - new Date(record.timestamp).getTime() <= THRESHOLD_READING_MAX_AGE_MS
}

// Có số đo và nằm ngoài khoảng [min, max]; thiếu số đo thì không tính là lệch
function isOutside(value: number | undefined, min: number | undefined, max: number | undefined): boolean {
  if (value === undefined) return false
  if (min !== undefined && value < min) return true
  return max !== undefined && value > max
}

// Các chỉ số của bản ghi mới nhất đang lệch ngưỡng của Zone
export function getBreachedMetrics(record: TelemetryRecord, thresholds: Thresholds): ThresholdMetric[] {
  const checks: [ThresholdMetric, boolean][] = [
    ['temperature', isOutside(record.temperature, thresholds.temp_min, thresholds.temp_max)],
    ['humidity', isOutside(record.humidity, thresholds.humidity_min, thresholds.humidity_max)],
    ['light', isOutside(record.light_lux, undefined, thresholds.light_max)],
    ['nh3', isOutside(record.nh3_ppm, undefined, thresholds.nh3_max)],
    ['co2', isOutside(record.co2_ppm, undefined, thresholds.co2_max)],
  ]
  return checks.filter(([, isBreached]) => isBreached).map(([metric]) => metric)
}
