// Không nhận "true": Express sẽ tin mục X-Forwarded-For do client tự đặt
export function parseTrustProxy(raw: string | undefined): boolean | number | string {
  const value = raw?.trim()
  if (!value || /^(false|0)$/i.test(value)) return false
  if (/^\d+$/.test(value)) return Number(value)
  if (/^true$/i.test(value)) {
    throw new Error(
      'TRUST_PROXY=true không an toàn (tin X-Forwarded-For do client tự đặt) — dùng số hop proxy (VD 1) hoặc danh sách IP/CIDR của proxy',
    )
  }
  return value
}
