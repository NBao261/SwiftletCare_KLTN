import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'vi' | 'en'

interface LanguageState {
  lang: Lang
  setLang: (lang: Lang) => void
}

/** Ngôn ngữ hiển thị đang chọn (nút VI/EN ở AppHeader) — thuần client, lưu localStorage để giữ qua lần mở sau */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      lang: 'vi',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'swiftletcare-lang', version: 1 },
  ),
)
