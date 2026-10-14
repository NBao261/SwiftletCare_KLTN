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
  const fmt = (relativeFormatters[lang] ??= new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' }))
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return fmt.format(seconds, 'second')
  if (abs < 3600) return fmt.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return fmt.format(Math.round(seconds / 3600), 'hour')
  return fmt.format(Math.round(seconds / 86400), 'day')
}

/** Số theo locale: vi "1,51" · en "1.51" */
export function formatNumber(value: number, lang: Lang, digits = 0): string {
  return value.toLocaleString(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Ngày theo giờ VN (nhất quán với phần còn lại của app) nhưng định dạng theo ngôn ngữ đang chọn */
export function formatDay(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(LOCALE[lang], { timeZone: 'Asia/Ho_Chi_Minh' })
}
