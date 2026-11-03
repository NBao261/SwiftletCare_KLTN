import { getCurrentLanguage } from '@/utils/i18n.utils'
// Nhiệt độ 1 chữ số thập phân ("28.4°C")
export function formatTemperature(value: number): string {
  return `${value.toFixed(1)}°C`
}

// Độ ẩm 1 chữ số thập phân ("82.0%")
export function formatHumidity(value: number): string {
  return `${value.toFixed(1)}%`
}

// Tỉ lệ 0–1 thành phần trăm ("0.875" → "87.5%")
export function formatPercentage(ratio: number, decimals = 1): string {
  return `${(ratio * 100).toFixed(decimals)}%`
}

// Giá trị đã là phần trăm, dấu thập phân theo ngôn ngữ: tiếng Việt "94,7%", tiếng Anh "94.7%"
export function formatPercentValue(value: number, decimals = 1): string {
  const fixed = value.toFixed(decimals)
  return `${getCurrentLanguage() === 'en' ? fixed : fixed.replace('.', ',')}%`
}

// Số thập phân theo ngôn ngữ, có ngăn hàng nghìn: tiếng Việt "1.320" / "29,8", tiếng Anh "1,320" / "29.8"
export function formatDecimal(value: number, decimals = 0): string {
  const isEnglish = getCurrentLanguage() === 'en'
  const [integerPart, fractionPart] = Math.abs(value).toFixed(decimals).split('.')
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, isEnglish ? ',' : '.')
  const sign = value < 0 && Number(Math.abs(value).toFixed(decimals)) !== 0 ? '-' : ''
  return `${sign}${grouped}${fractionPart ? `${isEnglish ? '.' : ','}${fractionPart}` : ''}`
}
