import { useLanguageStore } from '@/stores/languageStore'

// Ngôn ngữ đang chọn — component đọc hook này để dựng lại khi đổi ngôn ngữ (đặt key = ngôn ngữ ở gốc màn)
export function useLanguage() {
  return useLanguageStore(state => state.language)
}
