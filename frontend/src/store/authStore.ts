import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user:            User | null
  accessToken:     string | null
  isAuthenticated: boolean
  setAuth:         (user: User, accessToken: string) => void
  clearAuth:       () => void
  setAccessToken:  (token: string) => void
  /** Gộp field mới vào user hiện tại — dùng khi API chỉ trả message, không trả lại User đầy đủ */
  updateUser:      (partial: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      accessToken:     null,
      isAuthenticated: false,
      setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
      clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false }),
      setAccessToken: (token) => set({ accessToken: token }),
      updateUser: (partial) => set(s => ({ user: s.user ? { ...s.user, ...partial } : s.user })),
    }),
    { name: 'swiftletcare-auth', partialize: (s) => ({ user: s.user, accessToken: s.accessToken, isAuthenticated: s.isAuthenticated }) }
  )
)
