// SwiftletCare utility functions
import { intlLocale, t } from '@/i18n'

/** Mức tín hiệu Wi-Fi theo RSSI (dBm) — chung cho bảng thiết bị Farm Owner (key i18n `wifi.*`) và Admin */
export function wifiQuality(rssi: number | undefined): 'excellent' | 'good' | 'fair' | 'weak' | undefined {
  if (rssi === undefined) return undefined
  if (rssi >= -55) return 'excellent'
  if (rssi >= -67) return 'good'
  if (rssi >= -75) return 'fair'
  return 'weak'
}

/** Format date to Vietnamese locale */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

/** Chỉ phần ngày/giờ riêng — dùng cho ô bảng 2 tầng (ngày đậm phía trên, giờ xám phía dưới) */
export const formatDateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
export const formatTimeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

const VN_HM = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })
const VN_DAY = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })

/** Giờ:phút theo giờ VN (không giây) */
export const formatHM = (date: string | Date) => VN_HM.format(new Date(date))

/** "Hôm nay" / "Hôm qua" theo ngày VN, ngày cũ hơn thì dd/mm/yyyy */
export function vnDayLabel(date: string | Date, now = new Date()) {
  const day = VN_DAY.format(new Date(date))
  if (day === VN_DAY.format(now)) return t('Hôm nay')
  if (day === VN_DAY.format(new Date(now.getTime() - 86_400_000))) return t('Hôm qua')
  return day
}

/** "Hôm nay · 07:48" / "17/09/2026 · 18:24" — cùng kiểu cột Thời gian của Nhật ký hệ thống */
export const formatDayTime = (date: string | Date) => `${vnDayLabel(date)} · ${formatHM(date)}`

const VN_YEAR_MONTH =new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric' })

/** Năm + tháng (1-12) theo giờ VN — gom số liệu theo tháng khớp với ngày hiển thị, không lệch theo múi giờ máy người dùng */
export function vnYearMonth(date: string | Date): { year: number; month: number } {
  const parts = VN_YEAR_MONTH.formatToParts(new Date(date))
  const get = (type: 'year' | 'month') => Number(parts.find(p => p.type === type)?.value)
  return { year: get('year'), month: get('month') }
}

const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60], ['minute', 60], ['hour', 24], ['day', 7], ['week', 4.35], ['month', 12], ['year', Infinity],
]

/** "5 phút trước", "hôm qua"... — tính theo đồng hồ máy người dùng */
export function formatRelativeTime(iso: string, now = Date.now()) {
  let value = (new Date(iso).getTime() - now) / 1000
  for (const [unit, size] of RELATIVE_STEPS) {
    // Tạo theo ngôn ngữ đang chọn (VI/EN) mỗi lần gọi — không cache 1 locale cố định
    if (Math.abs(value) < size) return new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' }).format(Math.round(value), unit)
    value /= size
  }
  return formatDate(iso)
}

/**
 * Độ dài 1 khoảng thời gian, chính xác tới phút, lấy 2 đơn vị lớn nhất cho dễ đọc:
 * "45 phút", "3 giờ 20 phút", "1 ngày 4 giờ". Bỏ dấu (dùng cho cả "còn …" lẫn "quá hạn …").
 */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.abs(ms) / 60_000)
  if (minutes < 1) return t('dưới 1 phút')
  const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60
  if (d > 0) return h ? t('{{d}} ngày {{h}} giờ', { d, h }) : t('{{d}} ngày', { d })
  if (h > 0) return m ? t('{{h}} giờ {{m}} phút', { h, m }) : t('{{h}} giờ', { h })
  return t('{{m}} phút', { m })
}

/** Format sensor value with unit */
export const formatSensor = (value: number | undefined, unit: string, decimals = 1) =>
  value !== undefined ? `${value.toFixed(decimals)} ${unit}` : '--'

/** Format return rate */
export const formatReturnRate = (rate: number) => `${rate.toFixed(1)}%`

/**
 * Lấy message lỗi từ response envelope chuẩn `{success:false, error:{code,message}}`
 * (axios error) — DRY hoá pattern lặp lại ở mọi form gọi API.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
  return message ?? fallback
}
