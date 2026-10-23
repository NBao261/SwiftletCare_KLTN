import { useCallback, useMemo } from 'react'
import { useLanguageStore } from '@/stores/languageStore'
import { formatDateTime, formatDay, formatExactNumber, formatHourMinute, formatNumber, formatRelative, formatStandardDate, formatTime, translate, type Dictionary } from '@/lib/i18n'

// Dịch theo ngôn ngữ đang chọn, mỗi module truyền từ điển của mình
export function useTranslation<K extends string>(dict: Dictionary<K>) {
  const lang = useLanguageStore(state => state.lang)
  const t = useCallback(
    (key: K, params?: Record<string, string | number>) => translate(dict, lang, key, params),
    [dict, lang],
  )
  // Hàm định dạng phụ thuộc duy nhất vào ngôn ngữ — giữ identity ổn định để dùng làm dependency của useMemo/useCallback
  const formatters = useMemo(() => ({
    num: (value: number, digits = 0) => formatNumber(value, lang, digits),
    // Không làm tròn số liệu đo (VD sản lượng tính từ gram): chỉ cắt sau maxDigits chữ số lẻ
    exact: (value: number, maxDigits: number) => formatExactNumber(value, lang, maxDigits),
    day: (iso: string) => formatDay(iso, lang),
    time: (iso: string) => formatTime(iso, lang),
    date: formatStandardDate,
    hourMinute: formatHourMinute,
    dateTime: formatDateTime,
    ago: (iso: string | undefined) => formatRelative(iso, lang),
  }), [lang])
  return { t, lang, ...formatters }
}
