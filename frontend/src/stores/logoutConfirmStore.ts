import { create } from 'zustand'

// Trạng thái mở/đóng popup xác nhận đăng xuất
interface LogoutConfirmState {
  open: boolean
  ask: () => void
  close: () => void
}

export const useLogoutConfirmStore = create<LogoutConfirmState>(set => ({
  open: false,
  ask: () => set({ open: true }),
  close: () => set({ open: false }),
}))
