import { Linking } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/services/api/auth.api'
import { useAuthStore } from '@/stores/authStore'

// Liên kết bot Telegram (ALERT-FR-013): lấy đường dẫn có mã dùng một lần (10 phút) rồi mở Telegram;
// huỷ liên kết thì cập nhật phiên đang lưu
export function useTelegramLink() {
  const updateUser = useAuthStore(state => state.updateUser)

  const link = useMutation({
    mutationFn: () => authApi.linkTelegram().then(response => response.data.data),
    onSuccess: ({ deep_link }) => Linking.openURL(deep_link),
  })
  const unlink = useMutation({
    mutationFn: () => authApi.unlinkTelegram(),
    onSuccess: () => updateUser({ telegram_linked: false }),
  })

  return { link, unlink }
}
