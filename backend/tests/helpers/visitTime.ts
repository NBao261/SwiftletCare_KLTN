const VN_OFFSET_MS = 7 * 3600_000

/** N ngày nữa lúc HH:MM giờ Việt Nam — mốc hẹn hợp lệ khi giờ nằm trong 7:00–18:00 */
export function vnAt(daysAhead: number, hour = 9, minute = 0): Date {
  const vn = new Date(Date.now() + daysAhead * 86400_000 + VN_OFFSET_MS)
  vn.setUTCHours(hour, minute, 0, 0)
  return new Date(vn.getTime() - VN_OFFSET_MS)
}
