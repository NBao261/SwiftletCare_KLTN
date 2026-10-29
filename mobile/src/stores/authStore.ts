import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { isMobileRole } from '@/constants/roleTabs'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  // Bản trong bộ nhớ của access token — apiClient đọc ở đây cho nhanh, SecureStore chỉ để giữ qua lần mở app sau
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>
  setAccessToken: (accessToken: string) => Promise<void>
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
    // Ba khoá độc lập — ghi song song cho đăng nhập nhanh hơn
    await Promise.all([
      SecureStore.setItemAsync('accessToken', accessToken),
      SecureStore.setItemAsync('refreshToken', refreshToken),
      SecureStore.setItemAsync('user', JSON.stringify(user)),
    ])
    set({ user, accessToken, isAuthenticated: true, isLoading: false })
  },

  // Access token mới sau khi làm mới (POST /auth/refresh)
  setAccessToken: async accessToken => {
    set({ accessToken })
    await SecureStore.setItemAsync('accessToken', accessToken)
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
    await Promise.all([
      SecureStore.deleteItemAsync('accessToken'),
      SecureStore.deleteItemAsync('refreshToken'),
      SecureStore.deleteItemAsync('user'),
    ])
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
  },

  // Đọc lại phiên đã lưu khi mở app, trước khi ẩn splash; role không dùng mobile thì bỏ phiên
  loadStoredAuth: async () => {
    try {
      const [accessToken, storedUser] = await Promise.all([
        SecureStore.getItemAsync('accessToken'),
        SecureStore.getItemAsync('user'),
      ])
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
