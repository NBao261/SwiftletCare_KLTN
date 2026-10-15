import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_READ_PER_USER = 500

interface ReadAlertState {
  readByUser: Record<string, string[]>
  markRead: (userId: string, alertId: string) => void
}

// Cảnh báo đã xổ đọc trong popup chuông, mỗi tài khoản 1 danh sách (backend chỉ có trạng thái xác nhận, không có "đã đọc")
export const useReadAlertStore = create<ReadAlertState>()(
  persist(
    (set) => ({
      readByUser: {},
      markRead: (userId, alertId) => set(s => {
        const current = s.readByUser[userId] ?? []
        if (current.includes(alertId)) return s
        return { readByUser: { ...s.readByUser, [userId]: [...current, alertId].slice(-MAX_READ_PER_USER) } }
      }),
    }),
    { name: 'swiftletcare-read-alerts', version: 1 },
  ),
)
