import { getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import type { AnalyticsRange, BirdCountDay, EnvSeriesPoint, Thresholds } from '@/types'
import { getVietnamDayStart } from '@/utils/date.utils'
import { METRIC_DECIMALS } from '@/utils/sensorTile.utils'
import type { SensorMetric } from '@/utils/threshold.utils'

const DAY_MS = 24 * 60 * 60 * 1000

// Gộp số đếm chim theo ngày, tuần (ISO) hoặc tháng (ANALYTICS-FR-002)
export type BirdPeriod = 'day' | 'week' | 'month'

export interface BirdPeriodRow {
  key: string
  // Ngày đầu của kỳ (YYYY-MM-DD giờ Việt Nam) để làm nhãn trục
  startDate: string
  // Chim ra ròng, chim về ròng cộng của các ngày trong kỳ
  exit: number
  entry: number
  // Tổng về / tổng ra × 100 của các ngày đủ cả hai phiên; không ngày nào đủ thì null
  returnRate: number | null
  // Có ngày thiếu phiên sáng hoặc chiều (has_morning / has_evening của backend)
  isIncomplete: boolean
  days: BirdCountDay[]
}

// Khoá kỳ của một ngày YYYY-MM-DD
function getPeriodKey(date: string, period: BirdPeriod): string {
  if (period === 'day') return date
  if (period === 'month') return date.slice(0, 7)
  const day = parseISO(date)
  return `${getISOWeekYear(day)}-W${String(getISOWeek(day)).padStart(2, '0')}`
}

// Một ngày có đủ phiên sáng và chiều để tính tỉ lệ về tổ
function isCompleteDay(day: BirdCountDay): boolean {
  return day.has_morning && day.has_evening && day.return_rate !== null
}

// Tỉ lệ về tổ của nhiều ngày: tổng chim về ròng / tổng chim ra ròng của các ngày đủ phiên, cùng công thức của backend
export function averageReturnRate(days: BirdCountDay[]): number | null {
  let entry = 0
  let exit = 0
  for (const day of days) {
    if (!isCompleteDay(day)) continue
    entry += day.net_entry
    exit += day.net_exit
  }
  return exit > 0 ? (entry / exit) * 100 : null
}

// Gộp các ngày theo kỳ, kỳ sớm nhất trước. Ngày không có dữ liệu không có dòng (backend không trả) nên không tạo kỳ rỗng
export function groupBirdDays(days: BirdCountDay[], period: BirdPeriod): BirdPeriodRow[] {
  const groups = new Map<string, BirdCountDay[]>()
  for (const day of [...days].sort((first, second) => first.date.localeCompare(second.date))) {
    const key = getPeriodKey(day.date, period)
    groups.set(key, [...(groups.get(key) ?? []), day])
  }
  return [...groups.entries()].map(([key, groupDays]) => ({
    key,
    startDate: groupDays[0].date,
    exit: groupDays.reduce((total, day) => total + day.net_exit, 0),
    entry: groupDays.reduce((total, day) => total + day.net_entry, 0),
    returnRate: averageReturnRate(groupDays),
    isIncomplete: groupDays.some(day => !day.has_morning || !day.has_evening),
    days: groupDays,
  }))
}

// Số ngày của khoảng khi tính theo ngày (đàn chim, tương quan): 24 giờ là hôm nay
export function getRangeDays(range: AnalyticsRange): number {
  if (range === '30d') return 30
  if (range === '7d') return 7
  return 1
}

export interface TimeWindow {
  from: string
  to: string
}

// Kỳ này và kỳ trước cùng độ dài, tính theo ngày giờ Việt Nam: kỳ này từ 00:00 của ngày đầu tới bây giờ
export function getDayWindows(days: number, now: number): { current: TimeWindow; previous: TimeWindow } {
  const currentStart = getVietnamDayStart(now) - (days - 1) * DAY_MS
  const previousStart = currentStart - days * DAY_MS
  return {
    current: { from: new Date(currentStart).toISOString(), to: new Date(now).toISOString() },
    previous: { from: new Date(previousStart).toISOString(), to: new Date(currentStart - 1).toISOString() },
  }
}

export type Trend = 'up' | 'down' | 'flat'

// Chiều so với kỳ trước; thiếu một trong hai số thì null
export function compareWithPrevious(current: number | null, previous: number | null): Trend | null {
  if (current === null || previous === null) return null
  const difference = Math.round((current - previous) * 10) / 10
  if (difference === 0) return 'flat'
  return difference > 0 ? 'up' : 'down'
}

// Hệ số tương quan Pearson của các cặp đủ hai số; dưới 3 cặp hoặc một bên không đổi thì null
export function pearson(pairs: [number | null, number | null][]): number | null {
  const valid = pairs.filter((pair): pair is [number, number] => pair[0] !== null && pair[1] !== null)
  if (valid.length < 3) return null
  const meanX = valid.reduce((total, [x]) => total + x, 0) / valid.length
  const meanY = valid.reduce((total, [, y]) => total + y, 0) / valid.length
  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (const [x, y] of valid) {
    covariance += (x - meanX) * (y - meanY)
    varianceX += (x - meanX) ** 2
    varianceY += (y - meanY) ** 2
  }
  if (varianceX === 0 || varianceY === 0) return null
  return covariance / Math.sqrt(varianceX * varianceY)
}

// Trường của chuỗi môi trường ứng với từng chỉ số cảm biến
export const ENV_SERIES_KEY: Record<SensorMetric, keyof EnvSeriesPoint> = {
  temperature: 'temperature',
  humidity: 'humidity',
  light: 'light_lux',
  nh3: 'nh3_ppm',
  co2: 'co2_ppm',
  sound: 'sound_db',
}

// Mức thấp, mức cao của zone cho một chỉ số; ánh sáng, NH3, CO2 chỉ có mức cao, tiếng ồn không có ngưỡng
export function getThresholdBounds(metric: SensorMetric, thresholds: Thresholds): { min?: number; max?: number } {
  const bounds: Record<SensorMetric, { min?: number; max?: number }> = {
    temperature: { min: thresholds.temp_min, max: thresholds.temp_max },
    humidity: { min: thresholds.humidity_min, max: thresholds.humidity_max },
    light: { max: thresholds.light_max },
    nh3: { max: thresholds.nh3_max },
    co2: { max: thresholds.co2_max },
    sound: {},
  }
  return bounds[metric]
}

export interface EnvLinePoint {
  timestamp: string
  // Đã làm tròn đúng số lẻ như web; null là khung không có số đo (vẽ khoảng trống, không nối)
  value: number | null
  isOutOfRange: boolean
}

// Chuỗi một chỉ số để vẽ: đúng số lẻ của chỉ số, đánh dấu điểm ngoài ngưỡng
export function buildEnvLine(
  series: EnvSeriesPoint[],
  metric: SensorMetric,
  bounds: { min?: number; max?: number },
): EnvLinePoint[] {
  const factor = 10 ** METRIC_DECIMALS[metric]
  return series.map(point => {
    const raw = point[ENV_SERIES_KEY[metric]]
    const value = typeof raw === 'number' ? Math.round(raw * factor) / factor : null
    const isOutOfRange =
      value !== null &&
      ((bounds.min !== undefined && value < bounds.min) || (bounds.max !== undefined && value > bounds.max))
    return { timestamp: point.timestamp, value, isOutOfRange }
  })
}

// Thấp nhất, cao nhất của các số có thật (câu tóm tắt cho trình đọc màn hình); không có số nào thì null
export function summarizeValues(values: (number | null)[]): { min: number; max: number } | null {
  const numbers = values.filter((value): value is number => value !== null)
  if (numbers.length === 0) return null
  return { min: Math.min(...numbers), max: Math.max(...numbers) }
}

// Khung trục Y vừa dữ liệu và ngưỡng, nới 10% hai đầu; không bắt đầu từ 0 để độ ẩm 70–95 không bị ép dẹt
export function getAxisBounds(
  values: (number | null)[],
  extras: (number | undefined)[],
): { base: number; top: number } {
  const numbers = [...values, ...extras].filter((value): value is number => typeof value === 'number')
  if (numbers.length === 0) return { base: 0, top: 1 }
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  const padding = Math.max((max - min) * 0.1, Math.abs(max) * 0.02, 1)
  return { base: Math.floor(min - padding), top: Math.ceil(max + padding) }
}
