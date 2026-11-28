// Tên miền của SwiftletCare, ghi ở chân thư (liên kết trong thư theo appPublicUrl, đổi được theo môi trường)
export const BRAND_DOMAIN = 'swiftletcare.io.vn'
export const BRAND_URL = `https://${BRAND_DOMAIN}`

// Địa chỉ công khai của ứng dụng web, cho liên kết trong thư và nút Telegram
export function appPublicUrl(): string {
  const configured = process.env.APP_PUBLIC_URL?.trim() || process.env.CORS_ORIGIN?.split(',')[0]?.trim()
  return (configured || 'http://localhost:5173').replace(/\/+$/, '')
}
