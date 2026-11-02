import { useEffect, useState } from 'react'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore, type Language } from '@/stores/languageStore'

// Cho lớp chờ kịp hiện rồi mới đổi ngôn ngữ (dựng lại cả màn)
const OVERLAY_APPEAR_MS = 50
// Giữ lớp chờ thêm 500 ms sau khi đổi để các khối dựng lại xong
const LANGUAGE_SWITCH_MS = 500
const TOAST_DURATION_MS = 2500

// Đổi qua lại Việt ⇄ Anh cho tài khoản đang đăng nhập: lớp chờ hiện → đổi ngôn ngữ → giữ thêm 500 ms → ẩn lớp chờ, hiện toast
export function useSwitchLanguage() {
  const user = useAuthStore(state => state.user)
  const language = useLanguage()
  const setLanguage = useLanguageStore(state => state.setLanguage)
  // Ngôn ngữ đang đổi sang — có giá trị thì hiện lớp chờ và chặn thao tác
  const [switchingTo, setSwitchingTo] = useState<Language | null>(null)
  // Ngôn ngữ vừa đổi xong — có giá trị thì hiện toast
  const [switchedTo, setSwitchedTo] = useState<Language | null>(null)

  useEffect(() => {
    if (!switchingTo || !user) return
    const applyTimer = setTimeout(() => setLanguage(switchingTo, user._id), OVERLAY_APPEAR_MS)
    const doneTimer = setTimeout(() => {
      setSwitchingTo(null)
      setSwitchedTo(switchingTo)
    }, OVERLAY_APPEAR_MS + LANGUAGE_SWITCH_MS)
    return () => {
      clearTimeout(applyTimer)
      clearTimeout(doneTimer)
    }
  }, [switchingTo, user, setLanguage])

  // Toast tự ẩn sau vài giây
  useEffect(() => {
    if (!switchedTo) return
    const timer = setTimeout(() => setSwitchedTo(null), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [switchedTo])

  const switchLanguage = () => {
    if (!user || switchingTo) return
    setSwitchedTo(null)
    setSwitchingTo(language === 'vi' ? 'en' : 'vi')
  }

  return { language, switchingTo, switchedTo, switchLanguage }
}
