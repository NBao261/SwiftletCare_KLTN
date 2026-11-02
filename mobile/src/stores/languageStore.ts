import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

// Ngôn ngữ giao diện: tiếng Việt là bản gốc, tiếng Anh dịch theo constants/i18n.en.ts.
// Để ở Zustand chứ không ở React Query: đây là lựa chọn của người dùng trên máy (backend không có trường ngôn ngữ),
// mọi màn và cả hàm thường (t()) đọc chung, kể cả trước khi đăng nhập
export type Language = 'vi' | 'en'

const DEFAULT_LANGUAGE: Language = 'vi'
// Ngôn ngữ dùng gần nhất trên máy — cho các màn trước khi đăng nhập (chưa biết tài khoản nào)
const DEVICE_LANGUAGE_KEY = 'swiftletcare.language.device'

// Lưu theo từng tài khoản trên máy (backend chưa có trường ngôn ngữ): đổi tài khoản thì lấy ngôn ngữ của tài khoản đó
function accountKey(userId: string): string {
  return `swiftletcare.language.${userId}`
}

// Đọc một khoá đã lưu; không có hoặc lỗi thì null
async function readLanguage(key: string): Promise<Language | null> {
  const stored = await SecureStore.getItemAsync(key).catch(() => null)
  return stored === 'en' || stored === 'vi' ? stored : null
}

interface LanguageState {
  language: Language
  // Đổi ngôn ngữ, lưu cho tài khoản đang đăng nhập và làm ngôn ngữ mặc định của máy
  setLanguage: (language: Language, userId: string) => Promise<void>
  // Đăng nhập / mở lại app: ngôn ngữ của tài khoản, chưa lưu thì giữ ngôn ngữ của máy
  loadLanguage: (userId: string) => Promise<void>
  // Chưa đăng nhập: ngôn ngữ dùng gần nhất trên máy, chưa có thì tiếng Việt
  loadDeviceLanguage: () => Promise<void>
}

export const useLanguageStore = create<LanguageState>(set => ({
  language: DEFAULT_LANGUAGE,

  setLanguage: async (language, userId) => {
    set({ language })
    await Promise.all([
      SecureStore.setItemAsync(accountKey(userId), language),
      SecureStore.setItemAsync(DEVICE_LANGUAGE_KEY, language),
    ]).catch(() => undefined)
  },

  loadLanguage: async userId => {
    const language = (await readLanguage(accountKey(userId))) ?? (await readLanguage(DEVICE_LANGUAGE_KEY))
    set({ language: language ?? DEFAULT_LANGUAGE })
    // Tài khoản vừa vào làm ngôn ngữ của máy cho lần mở app sau, kể cả màn đăng nhập
    if (language) await SecureStore.setItemAsync(DEVICE_LANGUAGE_KEY, language).catch(() => undefined)
  },

  loadDeviceLanguage: async () => {
    set({ language: (await readLanguage(DEVICE_LANGUAGE_KEY)) ?? DEFAULT_LANGUAGE })
  },
}))
