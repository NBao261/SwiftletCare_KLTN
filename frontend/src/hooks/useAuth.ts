import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

/** useAuth – login/register/logout (AUTH-FR-001..003) */
export function useAuth() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const clearAuth = useAuthStore(s => s.clearAuth)

  const login = useMutation({
    mutationFn: (input: { email: string; password: string }) => authApi.login(input),
    onSuccess: ({ data }) => {
      setAuth(data.data.user, data.data.accessToken)
      navigate('/dashboard')
    },
  })

  const register = useMutation({
    mutationFn: (input: { email: string; password: string; full_name: string; phone?: string }) =>
      authApi.register(input),
    onSuccess: () => navigate('/login'),
  })

  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearAuth()
      navigate('/login')
    },
  })

  return { login, register, logout }
}
