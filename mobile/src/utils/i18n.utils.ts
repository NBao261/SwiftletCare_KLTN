import { EN_TRANSLATIONS } from '@/constants/i18n.en'
import { useLanguageStore, type Language } from '@/stores/languageStore'

type TranslationValues = Record<string, string | number>

// Dịch một câu theo ngôn ngữ chỉ định. Khoá là chính câu tiếng Việt (giống web): tiếng Việt trả nguyên câu,
// tiếng Anh tra từ điển, thiếu bản dịch thì vẫn hiện tiếng Việt. Biến viết dạng {name}: translate('{count} nhà yến', 'en', { count: 2 })
export function translate(text: string, language: Language, values?: TranslationValues): string {
  const template = language === 'en' ? (EN_TRANSLATIONS[text] ?? text) : text
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match))
}

// Dịch theo ngôn ngữ đang chọn. Màn hình dựng lại toàn bộ khi đổi ngôn ngữ (key = ngôn ngữ) nên gọi thẳng trong
// hàm thường và component đều ra đúng ngôn ngữ
export function t(text: string, values?: TranslationValues): string {
  return translate(text, useLanguageStore.getState().language, values)
}

// Ngôn ngữ đang chọn, cho các hàm định dạng ngày và số
export function getCurrentLanguage(): Language {
  return useLanguageStore.getState().language
}
