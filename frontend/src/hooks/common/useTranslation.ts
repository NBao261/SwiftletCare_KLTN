import { useCallback, useMemo } from 'react'
import { useLanguageStore } from '@/stores/languageStore'
import { formatDay, formatNumber, formatRelative, formatTime, translate, type Dictionary } from '@/lib/i18n'

/**
 * Dịch theo ngôn ngữ đang chọn ở AppHeader — mỗi module truyền từ điển của mình
 * (`useTranslation(farmDict)`), nên màn nào chưa có từ điển vẫn hiển thị tiếng Việt như cũ.
 * Đơn vị đo (°C, %, ppm, lux, dB) không dịch (FE_Design §6).
 */
export function useTranslation<K extends string>(dict: Dictionary<K>) {
  const lang = useLanguageStore(s => s.lang)
  const t = useCallback(
    (key: K, params?: Record<string, string | number>) => translate(dict, lang, key, params),
    [dict, lang],
  )
  // Hàm định dạng phụ thuộc duy nhất vào ngôn ngữ — giữ identity ổn định để dùng làm dependency của useMemo/useCallback
  const fmt = useMemo(() => ({
    num: (value: number, digits = 0) => formatNumber(value, lang, digits),
    day: (iso: string) => formatDay(iso, lang),
    time: (iso: string) => formatTime(iso, lang),
    ago: (iso: string | undefined) => formatRelative(iso, lang),
  }), [lang])
  return { t, lang, ...fmt }
}
