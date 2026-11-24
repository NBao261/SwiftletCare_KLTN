// Không ghi log vì URL chứa bí mật: khoá trong query của /internal, token tải firmware của thiết bị.
// originalUrl giữ đường dẫn gốc dù router đã cắt tiền tố
export function isInternalRequest(req: { originalUrl?: string; url?: string }): boolean {
  const path = req.originalUrl ?? req.url ?? ''
  return path === '/internal' || path.startsWith('/internal/') || path.startsWith('/internal?') || path.startsWith('/firmware/ota/')
}
