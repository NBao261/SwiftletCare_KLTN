/**
 * Request của EMQX, MediaMTX tới /internal/* (mang khoá bí mật trong query): log truy cập bỏ qua. Morgan đưa vào
 * IncomingMessage; Express có thêm originalUrl (giữ nguyên đường dẫn gốc dù router đã cắt tiền tố)
 */
export function isInternalRequest(req: { originalUrl?: string; url?: string }): boolean {
  const path = req.originalUrl ?? req.url ?? ''
  return path === '/internal' || path.startsWith('/internal/') || path.startsWith('/internal?')
}
