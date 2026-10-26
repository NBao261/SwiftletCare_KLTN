// Đa ngôn ngữ VI/EN (FE_Design §6) — react-i18next, KHOÁ = chính câu tiếng Việt đang hiển thị:
//   t('Danh sách trang trại')  →  VI: trả nguyên câu (không cần file vi) · EN: tra en.ts, thiếu thì vẫn hiện tiếng Việt.
// Nhờ vậy code vẫn đọc được tiếng Việt, thêm bản dịch chỉ là thêm 1 dòng trong en.ts.
// Đổi ngôn ngữ: AppShell remount vùng nội dung (key = ngôn ngữ) nên `t` gọi thẳng trong hàm thường (column builder,
// helper định dạng ngày, bảng nhãn constants) cũng ra đúng ngôn ngữ — không cần useTranslation ở từng component.
import { Children, type ReactNode } from 'react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/en'
import { useLanguageStore, type Lang } from '@/stores/languageStore'

export type { Lang }

// Ngôn ngữ đang chọn lưu ở languageStore (dùng chung với useT của các màn Farm Owner) — i18next chỉ đi theo store,
// để 1 nút VI/EN đổi cả 2 hệ dịch
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: useLanguageStore.getState().lang,
  fallbackLng: false, // thiếu bản dịch → trả khoá (= câu tiếng Việt), không rơi sang ngôn ngữ khác
  keySeparator: false, // khoá là câu tự nhiên, có dấu "." ":" — không tách thành đường dẫn
  nsSeparator: false,
  interpolation: { escapeValue: false }, // React đã escape
})
/** <html lang> theo ngôn ngữ đang chọn (screen reader, gạch nối chữ) — bỏ qua khi chạy ngoài trình duyệt (vitest node) */
function syncHtmlLang(lang: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}
syncHtmlLang(i18n.language)
useLanguageStore.subscribe(({ lang }) => {
  if (lang === i18n.language) return
  void i18n.changeLanguage(lang)
  syncHtmlLang(lang)
})

/** Dịch 1 câu (khoá tiếng Việt); biến dạng {{n}}: t('Còn {{n}} ngày', { n: 3 }) */
export const t = (key: string, vars?: Record<string, unknown>): string => i18n.t(key, vars ?? {}) as string

export const setLang = (lang: Lang) => useLanguageStore.getState().setLang(lang)

/** Locale cho Intl (RelativeTimeFormat...) theo ngôn ngữ đang chọn */
export const intlLocale = () => (i18n.language === 'en' ? 'en-US' : 'vi-VN')

/**
 * Dịch prop chữ của component dùng chung (title, label, placeholder...) — chỉ dịch khi là chuỗi; ReactNode/số giữ nguyên.
 * Chuỗi không có trong en.ts (tên người, tên trại...) trả nguyên văn nên gọi trên dữ liệu thật cũng an toàn.
 */
export function tr<T>(value: T): T {
  return (typeof value === 'string' ? t(value) : value) as T
}

/** Như tr() cho children: dịch từng đoạn chữ, giữ nguyên icon/element (VD <Button><PlusIcon />Tạo tài khoản</Button>) */
export function trChildren(children: ReactNode): ReactNode {
  return Children.map(children, c => (typeof c === 'string' ? t(c) : c))
}

/** Bọc bảng nhãn constants (ROLE_LABEL, STATUS_LABEL...) để đọc giá trị là ra bản dịch hiện tại */
export function translated<T extends Record<string, string>>(labels: T): T {
  return new Proxy(labels, {
    get: (target, key) => {
      const value = Reflect.get(target, key)
      return typeof value === 'string' ? t(value) : value
    },
  })
}

export default i18n
