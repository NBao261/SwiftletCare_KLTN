import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/store'
import { authApi } from '@/services/api/auth'
import { connectSocket, disconnectSocket } from '@/services/socket'
import type { LoginResponse } from '@/types'

export function useLogin() {
  const setAuth = useAuthStore(s => s.setAuth)

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: async (res) => {
      const { accessToken, user } = (res.data as { data: LoginResponse }).data
      await setAuth(user, accessToken, '') // refreshToken from httpOnly cookie
      connectSocket()
    },
  })
}

export function useLogout() {
  const clearAuth = useAuthStore(s => s.clearAuth)

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: async () => {
      disconnectSocket()
      await clearAuth()
    },
  })
}
