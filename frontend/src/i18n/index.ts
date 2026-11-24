// Khoá là câu tiếng Việt; đổi ngôn ngữ thì AppShell remount nên t() trong hàm thường cũng đúng
import { Children, type ReactNode } from 'react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/en'
import enExpert from '@/i18n/en.expert'
import { useLanguageStore, type Lang } from '@/stores/languageStore'

export type { Lang }

// i18next đi theo languageStore để 1 nút VI/EN đổi cả 2 hệ dịch
void i18n.use(initReactI18next).init({
  // en.ts thắng khi trùng khoá với en.expert.ts
  resources: { en: { translation: { ...enExpert, ...en } } },
  lng: useLanguageStore.getState().lang,
  fallbackLng: false, // thiếu bản dịch → trả khoá (= câu tiếng Việt), không rơi sang ngôn ngữ khác
  keySeparator: false, // khoá là câu tự nhiên, có dấu "." ":": không tách thành đường dẫn
  nsSeparator: false,
  interpolation: { escapeValue: false }, // React đã escape
})
// Bỏ qua khi chạy ngoài trình duyệt (vitest)
function syncHtmlLang(lang: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}
syncHtmlLang(i18n.language)
useLanguageStore.subscribe(({ lang }) => {
  if (lang === i18n.language) return
  void i18n.changeLanguage(lang)
  syncHtmlLang(lang)
})

// Dịch 1 câu (khoá tiếng Việt); biến dạng {{n}}: t('Còn {{n}} ngày', { n: 3 })
export const t = (key: string, vars?: Record<string, unknown>): string => i18n.t(key, vars ?? {}) as string

export const setLang = (lang: Lang) => useLanguageStore.getState().setLang(lang)

// Locale cho Intl (RelativeTimeFormat...) theo ngôn ngữ đang chọn
export const intlLocale = () => (i18n.language === 'en' ? 'en-US' : 'vi-VN')

// Chỉ dịch chuỗi; chuỗi không có trong en.ts trả nguyên văn
export function tr<T>(value: T): T {
  return (typeof value === 'string' ? t(value) : value) as T
}

// Như tr() cho children, giữ nguyên icon
export function trChildren(children: ReactNode): ReactNode {
  return Children.map(children, c => (typeof c === 'string' ? t(c) : c))
}

// Bọc bảng nhãn constants (ROLE_LABEL, STATUS_LABEL...) để đọc giá trị là ra bản dịch hiện tại
export function translated<T extends Record<string, string>>(labels: T): T {
  return new Proxy(labels, {
    get: (target, key) => {
      const value = Reflect.get(target, key)
      return typeof value === 'string' ? t(value) : value
    },
  })
}

export default i18n
