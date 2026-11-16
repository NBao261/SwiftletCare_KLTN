import { BadRequestError } from '@/utils/appError.util'

/**
 * BR-38, ENV-FR-028…030 — bù phun sương theo dự báo thời tiết. Phần thuần (không DB, không MQTT) để test
 * riêng: kiểm luật của nhà và chọn offset từ dự báo 2 giờ tới. Firmware kẹp lại lần nữa
 * (`WeatherCompensation.cpp`), nên hai giới hạn dưới đây phải khớp `Config.h`.
 */

/** BR-38 — offset tối đa (điểm % của nhu cầu phun), cả hai chiều (Report 3 §4.5, A-4) */
export const WEATHER_COMP_MAX_PCT = 10
/** BR-38 — một offset hết hạn tối đa 2 giờ sau khi gửi (Report 3 §4.5, A-4) */
export const WEATHER_COMP_MAX_MS = 2 * 3600_000
/** ENV-FR-028 — cửa sổ dự báo xét luật: 2 giờ tới */
export const FORECAST_WINDOW_MS = 2 * 3600_000
/** Report 3 §4.5 — số luật tối đa của một nhà, để document nhà không lớn mãi */
export const MAX_WEATHER_RULES = 10

/**
 * ENV-FR-030 — điều kiện của luật luôn là "giá trị dự báo trong 2 giờ tới ≥ min": nhiệt độ cao nhất (°C),
 * độ ẩm ngoài trời cao nhất (%), tổng lượng mưa (mm). Khoảng nhập là giới hạn vật lý chống nhập nhầm,
 * không phải khuyến nghị nuôi yến.
 */
export const WEATHER_METRICS = ['temperature', 'humidity', 'rain'] as const
export type WeatherMetric = typeof WEATHER_METRICS[number]
export const WEATHER_METRIC_LIMITS: Record<WeatherMetric, { min: number; max: number; unit: string }> = {
  temperature: { min: 0, max: 50, unit: '°C' },
  humidity:    { min: 0, max: 100, unit: '%' },
  rain:        { min: 0.1, max: 50, unit: 'mm' },
}

export interface WeatherRuleInput {
  metric: WeatherMetric
  min: number
  offset_pct: number
  duration_min: number
  active: boolean
}

/** Dự báo 2 giờ tới đã gộp; trường null = Open-Meteo không có số đó */
export interface ForecastSummary {
  temperature_max: number | null
  humidity_max: number | null
  rain_mm: number | null
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** ENV-FR-030 — 400 khi offset ngoài ±10, thời hạn trên 2 giờ hoặc điều kiện ngoài khoảng */
export function assertValidWeatherRules(rules: WeatherRuleInput[]): void {
  if (rules.length > MAX_WEATHER_RULES) throw BadRequestError(`Mỗi nhà tối đa ${MAX_WEATHER_RULES} luật bù thời tiết`)
  rules.forEach((rule, i) => {
    const at = `Luật ${i + 1}`
    if (!WEATHER_METRICS.includes(rule.metric)) throw BadRequestError(`${at}: điều kiện không hỗ trợ`)
    const limit = WEATHER_METRIC_LIMITS[rule.metric]
    if (!isNumber(rule.min) || rule.min < limit.min || rule.min > limit.max) {
      throw BadRequestError(`${at}: ngưỡng phải từ ${limit.min} đến ${limit.max} ${limit.unit}`)
    }
    if (!isNumber(rule.offset_pct) || rule.offset_pct === 0 || Math.abs(rule.offset_pct) > WEATHER_COMP_MAX_PCT) {
      throw BadRequestError(`${at}: offset phải khác 0 và trong khoảng ±${WEATHER_COMP_MAX_PCT} điểm % (BR-38)`)
    }
    if (!Number.isInteger(rule.duration_min) || rule.duration_min < 1 || rule.duration_min * 60_000 > WEATHER_COMP_MAX_MS) {
      throw BadRequestError(`${at}: thời hạn từ 1 đến ${WEATHER_COMP_MAX_MS / 60_000} phút (BR-38)`)
    }
  })
}

const forecastValue = (forecast: ForecastSummary, metric: WeatherMetric): number | null =>
  metric === 'temperature' ? forecast.temperature_max : metric === 'humidity' ? forecast.humidity_max : forecast.rain_mm

/**
 * BR-38 — offset của nhà: trong các luật đang bật mà dự báo thoả, lấy luật có |offset| lớn nhất (bằng nhau thì
 * luật đứng trước). Không có dự báo hoặc không luật nào thoả thì null — nơi gọi gửi 0.
 */
export function pickCompensation<R extends WeatherRuleInput>(rules: R[], forecast: ForecastSummary | null): R | null {
  if (!forecast) return null
  let best: R | null = null
  for (const rule of rules) {
    if (!rule.active) continue
    const value = forecastValue(forecast, rule.metric)
    if (value === null || value < rule.min) continue
    if (!best || Math.abs(rule.offset_pct) > Math.abs(best.offset_pct)) best = rule
  }
  return best
}

interface OpenMeteoHourly {
  time?: string[]
  temperature_2m?: (number | null)[]
  relative_humidity_2m?: (number | null)[]
  precipitation?: (number | null)[]
}

/**
 * Gộp các mốc giờ dự báo trong (now, now + 2 h] (giờ GMT của Open-Meteo): nhiệt độ và độ ẩm cao nhất, tổng mưa.
 * Lượng mưa ở mốc T là tổng của giờ trước T, nên hai mốc này phủ đủ 2 giờ tới. Không mốc nào có số thì null.
 */
export function summariseForecast(hourly: OpenMeteoHourly | undefined, now: Date): ForecastSummary | null {
  const from = now.getTime()
  const to = now.getTime() + FORECAST_WINDOW_MS
  const temps: number[] = []
  const hums: number[] = []
  const rains: number[] = []
  ;(hourly?.time ?? []).forEach((time, i) => {
    const at = Date.parse(`${time}Z`)
    if (!Number.isFinite(at) || at <= from || at > to) return
    const t = hourly?.temperature_2m?.[i]
    const h = hourly?.relative_humidity_2m?.[i]
    const r = hourly?.precipitation?.[i]
    if (isNumber(t)) temps.push(t)
    if (isNumber(h)) hums.push(h)
    if (isNumber(r)) rains.push(r)
  })
  if (!temps.length && !hums.length && !rains.length) return null
  return {
    temperature_max: temps.length ? Math.max(...temps) : null,
    humidity_max: hums.length ? Math.max(...hums) : null,
    rain_mm: rains.length ? Math.round(rains.reduce((a, b) => a + b, 0) * 10) / 10 : null,
  }
}
