// Địa chỉ công khai của ứng dụng web, cho liên kết trong thư và nút Telegram
export function appPublicUrl(): string {
  const configured = process.env.APP_PUBLIC_URL?.trim() || process.env.CORS_ORIGIN?.split(',')[0]?.trim()
  return (configured || 'http://localhost:5173').replace(/\/+$/, '')
}
