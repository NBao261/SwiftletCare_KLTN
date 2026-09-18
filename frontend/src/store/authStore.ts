import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { queryClient } from '@/services/queryClient'
import type { User } from '@/types'

interface AuthState {
  user:            User | null
  accessToken:     string | null
  isAuthenticated: boolean
  /** true sau khi zustand/persist đọc xong localStorage — dùng để tránh flash sai UI khi F5 */
  hasHydrated:     boolean
  setAuth:         (user: User, accessToken: string) => void
  clearAuth:       () => void
  setAccessToken:  (token: string) => void
  /** Gộp field mới vào user hiện tại — dùng khi API chỉ trả message, không trả lại User đầy đủ */
  updateUser:      (partial: Partial<User>) => void
  setHasHydrated:  (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      accessToken:     null,
      isAuthenticated: false,
      hasHydrated:     false,
      setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
      clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false }),
      setAccessToken: (token) => set({ accessToken: token }),
      updateUser: (partial) => set(s => ({ user: s.user ? { ...s.user, ...partial } : s.user })),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'swiftletcare-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, isAuthenticated: s.isAuthenticated }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    }
  )
)

// Đồng bộ đăng xuất giữa các tab cùng trình duyệt — tab A bấm "Đăng xuất" (ghi
// localStorage) thì tab B đang mở cũng phải mất phiên ngay, không chờ tới lần
// gọi API kế tiếp mới bị 401 rồi mới biết. Chỉ đồng bộ CHIỀU ĐĂNG XUẤT (không
// đồng bộ đăng nhập) — tab B tự nhiên có phiên riêng, không nên bất ngờ đổi
// user chỉ vì tab A vừa đăng nhập.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'swiftletcare-auth' || !e.newValue) return
    try {
      const next = JSON.parse(e.newValue) as { state?: { isAuthenticated?: boolean } }
      if (next.state?.isAuthenticated === false && useAuthStore.getState().isAuthenticated) {
        useAuthStore.getState().clearAuth()
        queryClient.clear()
      }
    } catch {
      // localStorage bị sửa tay/hỏng định dạng — bỏ qua, không crash app
    }
  })
}
