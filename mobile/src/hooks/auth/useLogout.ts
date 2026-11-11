import { useMutation } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '@/services/api/auth.api'
import { pushTokenApi } from '@/services/api/pushToken.api'
import { getDevicePushState } from '@/services/notification/pushNotification'
import { clearLocalSession } from '@/services/session/localSession'

// Gỡ FCM token của máy trước khi thu hồi phiên (ALERT-FR-002: đăng xuất thì không nhận push nữa). Lỗi thì bỏ qua: đăng xuất
// không được kẹt vì push; tài khoản khác đăng nhập trên máy này thì backend cũng chuyển token sang người đó
async function removeDevicePushToken(): Promise<void> {
  try {
    const state = await getDevicePushState()
    if (state.kind === 'ready') await pushTokenApi.remove(state.payload.token)
  } catch {
    // bỏ qua
  }
}

// Đăng xuất: gỡ push của máy, thu hồi refresh token của máy này; dù backend lỗi vẫn xoá sạch phiên trên máy
export function useLogout() {
  return useMutation({
    retry: false,
    mutationFn: async () => {
      await removeDevicePushToken()
      const refreshToken = await SecureStore.getItemAsync('refreshToken')
      return authApi.logout(refreshToken ?? undefined)
    },
    onSettled: clearLocalSession,
  })
}
