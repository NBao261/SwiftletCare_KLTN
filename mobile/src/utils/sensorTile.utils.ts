import type { TelemetryRecord, Thresholds } from '@/types'
import { getMetricUnit } from '@/utils/label.utils'
import { formatDecimal } from '@/utils/number.utils'
import { getBreachedMetrics, isRecentReading, type SensorMetric } from '@/utils/threshold.utils'

// Thứ tự 6 ô trên lưới: 2 chỉ số điều khiển, ánh sáng, 2 khí chỉ cảnh báo, tiếng ồn
const SENSOR_METRICS: readonly SensorMetric[] = ['temperature', 'humidity', 'light', 'nh3', 'co2', 'sound']

export interface SensorTile {
  metric: SensorMetric
  // Số đã định dạng kèm đơn vị, đúng số lẻ như web; không có số đo thì "_" — dùng cho trình đọc màn hình
  valueText: string
  // Phần số ("31,2") và đơn vị ("°C") để vẽ đơn vị nhỏ hơn số như web; không có số đo thì "_" và đơn vị rỗng
  numberText: string
  unitText: string
  // Bản ghi có nhưng thiếu chỉ số này: cảm biến mất tín hiệu (THREAT-FR-013)
  isSignalLost: boolean
  // Khoảng ngưỡng của Zone như web: "26–31°C", "< 0,5 lux", "> 25 ppm"; tiếng ồn không có ngưỡng nên null
  rangeText: string | null
  // NH3, CO2 chỉ để cảnh báo, không điều khiển quạt (C-2): dòng dưới ghi "Cảnh báo khi …" thay vì "An toàn …"
  isAlertOnly: boolean
  // Số đo còn mới và nằm ngoài ngưỡng
  isOutOfRange: boolean
}

// Số chữ số lẻ cố định của từng chỉ số, theo bảng cảm biến của web (frontend EnvSensorPanel);
// riêng ánh sáng hiện số nguyên lux (đổi theo yêu cầu 2026-11-01), NH3 giữ 1 số lẻ vì backend trả ppm có phần lẻ
export const METRIC_DECIMALS: Record<SensorMetric, number> = {
  temperature: 1,
  humidity: 1,
  light: 0,
  nh3: 1,
  co2: 0,
  sound: 1,
}

// Lấy giá trị của một chỉ số trong bản ghi
function readMetric(record: TelemetryRecord, metric: SensorMetric): number | undefined {
  const values: Record<SensorMetric, number | undefined> = {
    temperature: record.temperature,
    humidity: record.humidity,
    light: record.light_lux,
    nh3: record.nh3_ppm,
    co2: record.co2_ppm,
    sound: record.sound_db,
  }
  return values[metric]
}

// Số kèm đơn vị với số lẻ cố định như web: "69,9%", "29,8°C", "1.320 ppm"
function formatValue(metric: SensorMetric, value: number): string {
  return `${formatDecimal(value, METRIC_DECIMALS[metric])}${getMetricUnit(metric)}`
}

// Mốc ngưỡng như web: số nguyên không có phần lẻ, số lẻ giữ 1 chữ số
function formatLimit(value: number): string {
  return formatDecimal(value, Number.isInteger(value) ? 0 : 1)
}

// Khoảng ngưỡng của Zone như web: "26–31°C", "< 0,5 lux", "> 25 ppm"; tiếng ồn không có ngưỡng nên null
export function formatThresholdRange(metric: SensorMetric, thresholds: Thresholds): string | null {
  const unit = getMetricUnit(metric)
  const ranges: Record<SensorMetric, string | null> = {
    temperature: `${formatLimit(thresholds.temp_min)}–${formatLimit(thresholds.temp_max)}${unit}`,
    humidity: `${formatLimit(thresholds.humidity_min)}–${formatLimit(thresholds.humidity_max)}${unit}`,
    light: `< ${formatLimit(thresholds.light_max)}${unit}`,
    nh3: `> ${formatLimit(thresholds.nh3_max)}${unit}`,
    co2: `> ${formatLimit(thresholds.co2_max)}${unit}`,
    sound: null,
  }
  return ranges[metric]
}

// 6 ô cảm biến của Zone từ bản ghi mới nhất; chưa có bản ghi thì mọi ô là "_"
export function buildSensorTiles(record: TelemetryRecord | null, thresholds: Thresholds, now: number): SensorTile[] {
  const breached = record && isRecentReading(record, now) ? new Set(getBreachedMetrics(record, thresholds)) : new Set()
  return SENSOR_METRICS.map(metric => {
    const value = record ? readMetric(record, metric) : undefined
    return {
      metric,
      valueText: value === undefined ? '_' : formatValue(metric, value),
      numberText: value === undefined ? '_' : formatDecimal(value, METRIC_DECIMALS[metric]),
      unitText: value === undefined ? '' : getMetricUnit(metric).trim(),
      isSignalLost: Boolean(record) && value === undefined,
      rangeText: formatThresholdRange(metric, thresholds),
      isAlertOnly: metric === 'nh3' || metric === 'co2',
      isOutOfRange: breached.has(metric),
    }
  })
}
