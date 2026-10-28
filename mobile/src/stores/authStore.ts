import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { isMobileRole } from '@/constants/roleTabs'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>
  updateUser: (changes: Partial<User>) => Promise<void>
  clearAuth: () => Promise<void>
  loadStoredAuth: () => Promise<void>
}

// Phiên đăng nhập — token và user chỉ lưu trong SecureStore (AUTH-FR-002, 003)
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('accessToken', accessToken)
    await SecureStore.setItemAsync('refreshToken', refreshToken)
    await SecureStore.setItemAsync('user', JSON.stringify(user))
    set({ user, accessToken, isAuthenticated: true, isLoading: false })
  },

  // Sửa thông tin user trong phiên, ví dụ bỏ cờ mật khẩu tạm sau khi đổi
  updateUser: async changes => {
    const currentUser = get().user
    if (!currentUser) return
    const user = { ...currentUser, ...changes }
    await SecureStore.setItemAsync('user', JSON.stringify(user))
    set({ user })
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('accessToken')
    await SecureStore.deleteItemAsync('refreshToken')
    await SecureStore.deleteItemAsync('user')
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
  },

  // Đọc lại phiên đã lưu khi mở app, trước khi ẩn splash; role không dùng mobile thì bỏ phiên
  loadStoredAuth: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken')
      const storedUser = await SecureStore.getItemAsync('user')
      const user = storedUser ? (JSON.parse(storedUser) as User) : null
      if (accessToken && user && isMobileRole(user.role)) {
        set({ user, accessToken, isAuthenticated: true, isLoading: false })
        return
      }
    } catch {
      // Dữ liệu phiên hỏng hoặc Keystore lỗi: bỏ phiên, không để app kẹt ở splash
    }
    await get().clearAuth().catch(() => undefined)
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
  },
}))
