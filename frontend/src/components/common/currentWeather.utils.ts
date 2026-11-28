import type { CurrentWeather } from '@/types'

export type WeatherIconName = 'sun' | 'moon' | 'partly-cloudy' | 'cloud' | 'fog' | 'rain' | 'storm' | 'unknown'
export type WeatherTone = 'sunny' | 'rainy' | 'neutral'

// Câu người nuôi đọc là hiểu: quang ban ngày là "Đang nắng", ban đêm là "Trời quang"
export function describeWeather(weather: Pick<CurrentWeather, 'condition' | 'is_day'>): { label: string; icon: WeatherIconName; tone: WeatherTone } {
  switch (weather.condition) {
    case 'CLEAR':
      return weather.is_day
        ? { label: 'Đang nắng', icon: 'sun', tone: 'sunny' }
        : { label: 'Trời quang', icon: 'moon', tone: 'neutral' }
    case 'PARTLY_CLOUDY': return { label: 'Có mây', icon: 'partly-cloudy', tone: 'neutral' }
    case 'CLOUDY': return { label: 'Nhiều mây', icon: 'cloud', tone: 'neutral' }
    case 'FOG': return { label: 'Có sương mù', icon: 'fog', tone: 'neutral' }
    case 'DRIZZLE': return { label: 'Đang mưa phùn', icon: 'rain', tone: 'rainy' }
    case 'RAIN': return { label: 'Đang mưa', icon: 'rain', tone: 'rainy' }
    case 'THUNDERSTORM': return { label: 'Đang mưa dông', icon: 'storm', tone: 'rainy' }
    default: return { label: 'Chưa rõ tình trạng trời', icon: 'unknown', tone: 'neutral' }
  }
}
