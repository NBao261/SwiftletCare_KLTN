import { useMutation } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '@/services/api/auth.api'
import { clearLocalSession } from '@/services/session/localSession'

// Đăng xuất: thu hồi refresh token của máy này; dù backend lỗi vẫn xoá sạch phiên trên máy
export function useLogout() {
  return useMutation({
    retry: false,
    mutationFn: async () => {
      const refreshToken = await SecureStore.getItemAsync('refreshToken')
      return authApi.logout(refreshToken ?? undefined)
    },
    onSettled: clearLocalSession,
  })
}
