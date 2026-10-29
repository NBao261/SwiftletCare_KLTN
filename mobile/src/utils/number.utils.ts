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
