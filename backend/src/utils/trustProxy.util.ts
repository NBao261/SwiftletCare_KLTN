/**
 * Đọc biến môi trường TRUST_PROXY thành giá trị cho `app.set('trust proxy', …)`.
 *
 * - Bỏ trống, "false" hoặc "0": tắt (req.ip là địa chỉ TCP trực tiếp).
 * - Số nguyên dương: số hop proxy tin cậy (VD 1 = chỉ tin proxy đứng ngay trước app).
 * - Chuỗi khác (loopback, linklocal, uniquelocal, danh sách IP/CIDR): chuyển nguyên cho
 *   Express, gõ sai thì Express báo lỗi ngay lúc khởi động.
 *
 * Cố tình KHÔNG nhận "true": khi đó Express tin mục ngoài cùng (do client tự đặt được)
 * của X-Forwarded-For, nên giả mạo được IP trong audit log và né rate limit theo IP.
 */
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
