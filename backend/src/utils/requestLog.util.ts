// Không ghi log vì URL chứa bí mật: khoá trong query của /internal, token tải firmware của thiết bị.
// originalUrl giữ đường dẫn gốc dù router đã cắt tiền tố
// Express định tuyến không phân biệt hoa thường: /Firmware/OTA/<token> cũng tới route tải
export function isInternalRequest(req: { originalUrl?: string; url?: string }): boolean {
  const path = (req.originalUrl ?? req.url ?? '').toLowerCase()
  return path === '/internal' || path.startsWith('/internal/') || path.startsWith('/internal?') || path.startsWith('/firmware/ota/')
}

// Đường dẫn để ghi log lỗi: bỏ query (khoá của /internal), che token tải firmware
export function loggablePath(req: { originalUrl?: string; url?: string }): string {
  return (req.originalUrl ?? req.url ?? '').split('?')[0].replace(/(\/firmware\/ota\/)[^/]*/i, '$1***')
}
