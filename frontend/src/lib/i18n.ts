import type { Lang } from '@/stores/languageStore'

/** Từ điển 1 module: `vi` là bản gốc, `en` bắt buộc đủ đúng các key của `vi` (thiếu key là lỗi biên dịch) */
export interface Dictionary<K extends string> {
  vi: Record<K, string>
  en: Record<K, string>
}

export const LOCALE: Record<Lang, string> = { vi: 'vi-VN', en: 'en-US' }

/** Thay `{name}` trong chuỗi bằng giá trị tương ứng — không có tham số thì trả chuỗi nguyên bản */
export function translate<K extends string>(
  dict: Dictionary<K>,
  lang: Lang,
  key: K,
  params?: Record<string, string | number>,
): string {
  const text = dict[lang][key]
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

const relativeFormatters: Partial<Record<Lang, Intl.RelativeTimeFormat>> = {}

/** "30 giây trước" / "30 seconds ago" — chọn đơn vị lớn nhất còn ≥ 1 */
export function formatRelative(iso: string | undefined, lang: Lang, now = Date.now()): string {
  if (!iso) return '—'
  const relativeFormatter = (relativeFormatters[lang] ??= new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' }))
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return relativeFormatter.format(seconds, 'second')
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relativeFormatter.format(Math.round(seconds / 3600), 'hour')
  return relativeFormatter.format(Math.round(seconds / 86400), 'day')
}

/** Số theo locale: vi "1,51" · en "1.51" */
export function formatNumber(value: number, lang: Lang, digits = 0): string {
  return value.toLocaleString(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Giờ theo múi giờ VN, định dạng 24h theo ngôn ngữ đang chọn */
export function formatTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(LOCALE[lang], { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
}

// Định dạng ngày giờ chuẩn FE_Design 6.1 — giờ Việt Nam, giống nhau ở VI và EN, dựng 1 lần
const STANDARD_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })
const STANDARD_HOUR_MINUTE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// Ngày DD/MM/YYYY
export function formatStandardDate(iso: string): string {
  return STANDARD_DATE.format(new Date(iso))
}

// Giờ HH:mm
export function formatHourMinute(iso: string): string {
  return STANDARD_HOUR_MINUTE.format(new Date(iso))
}

// Ngày giờ DD/MM/YYYY, HH:mm — dấu phẩy tách ngày với giờ cho dễ đọc
export function formatDateTime(iso: string): string {
  return `${formatStandardDate(iso)}, ${formatHourMinute(iso)}`
}

// Đổi mốc ISO trong chuỗi backend (VD "2026-09-17T15:34:00.721Z") sang DD/MM/YYYY, HH:mm
export function formatTimestampsInText(text: string): string {
  return text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z/g, match => formatDateTime(match))
}

/** Ngày theo giờ VN (nhất quán với phần còn lại của app) nhưng định dạng theo ngôn ngữ đang chọn */
export function formatDay(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(LOCALE[lang], { timeZone: 'Asia/Ho_Chi_Minh' })
}
