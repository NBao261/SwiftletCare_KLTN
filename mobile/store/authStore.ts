/**
 * Auth state – Zustand + SecureStore persistence
 * SRS: AUTH-FR-001 → AUTH-FR-006
 */
import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>
  clearAuth: () => Promise<void>
  loadStoredAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
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

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('accessToken')
    await SecureStore.deleteItemAsync('refreshToken')
    await SecureStore.deleteItemAsync('user')
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
  },

  loadStoredAuth: async () => {
    const token = await SecureStore.getItemAsync('accessToken')
    const userJson = await SecureStore.getItemAsync('user')
    if (token && userJson) {
      set({ user: JSON.parse(userJson) as User, accessToken: token, isAuthenticated: true, isLoading: false })
    } else {
      set({ isLoading: false })
    }
  },
}))
