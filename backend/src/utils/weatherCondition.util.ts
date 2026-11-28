// Tình trạng trời đang thấy ở ngoài nhà yến, gom từ mã thời tiết WMO của Open-Meteo thành vài loại người nuôi nhìn là hiểu
export const WEATHER_CONDITIONS = ['CLEAR', 'PARTLY_CLOUDY', 'CLOUDY', 'FOG', 'DRIZZLE', 'RAIN', 'THUNDERSTORM', 'OTHER'] as const
export type WeatherCondition = typeof WEATHER_CONDITIONS[number]

// WMO: 0-1 trời quang, 2 ít mây, 3 nhiều mây, 45-48 sương mù, 51-57 mưa phùn, 61-67 và 80-82 mưa (rào), 95-99 dông
export function conditionOfWeatherCode(code: unknown): WeatherCondition {
  if (typeof code !== 'number' || !Number.isInteger(code)) return 'OTHER'
  if (code === 0 || code === 1) return 'CLEAR'
  if (code === 2) return 'PARTLY_CLOUDY'
  if (code === 3) return 'CLOUDY'
  if (code === 45 || code === 48) return 'FOG'
  if (code >= 51 && code <= 57) return 'DRIZZLE'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'RAIN'
  if (code >= 95 && code <= 99) return 'THUNDERSTORM'
  return 'OTHER'
}

// Đang có mưa rơi: mưa phùn, mưa, dông
export const isRainy = (condition: WeatherCondition): boolean =>
  condition === 'DRIZZLE' || condition === 'RAIN' || condition === 'THUNDERSTORM'
