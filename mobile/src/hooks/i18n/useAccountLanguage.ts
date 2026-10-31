import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore } from '@/stores/languageStore'

// Đăng nhập hoặc mở lại app: lấy ngôn ngữ đã lưu của tài khoản; chưa đăng nhập: ngôn ngữ dùng gần nhất trên máy
export function useAccountLanguage() {
  const userId = useAuthStore(state => state.user?._id)
  const loadLanguage = useLanguageStore(state => state.loadLanguage)
  const loadDeviceLanguage = useLanguageStore(state => state.loadDeviceLanguage)

  useEffect(() => {
    if (userId) loadLanguage(userId)
    else loadDeviceLanguage()
  }, [userId, loadLanguage, loadDeviceLanguage])
}
