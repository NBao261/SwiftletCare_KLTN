// Trời hiện tại ở toạ độ của farm (GET /farms/houses/{houseId}/weather/current), lấy từ Open-Meteo
export type WeatherCondition = 'CLEAR' | 'PARTLY_CLOUDY' | 'CLOUDY' | 'FOG' | 'DRIZZLE' | 'RAIN' | 'THUNDERSTORM' | 'OTHER'

export interface CurrentWeather {
  observed_at: string
  condition: WeatherCondition
  // Đang mưa phùn, mưa hoặc dông
  is_raining: boolean
  is_day: boolean
  temperature_c: number | null
  humidity_pct: number | null
  precipitation_mm: number | null
  cloud_cover_pct: number | null
}

// weather null: farm chưa có toạ độ (NO_COORDINATES) hoặc chưa lấy được (UNAVAILABLE), không bao giờ là số 0
export interface CurrentWeatherResponse {
  house_id: string
  weather: CurrentWeather | null
  reason?: 'NO_COORDINATES' | 'UNAVAILABLE'
}
