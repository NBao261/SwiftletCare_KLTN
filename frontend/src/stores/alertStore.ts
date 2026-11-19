import { create } from 'zustand'

interface AlertState {
  /** ALERT-FR-007 — số cảnh báo ACTIVE (chờ xác nhận) của người dùng; đọc/chưa đọc chỉ thuộc hộp thông báo, không thuộc cảnh báo */
  pendingCount: number
  setPendingCount: (n: number) => void
}

export const useAlertStore = create<AlertState>((set) => ({
  pendingCount: 0,
  setPendingCount: (n) => set({ pendingCount: n }),
}))
