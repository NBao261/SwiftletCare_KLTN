import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PinnedHouseState {
  /** userId → id các nhà yến đã ghim (mỗi tài khoản trên cùng trình duyệt có danh sách riêng) */
  pinnedByUser: Record<string, string[]>
  toggle: (userId: string, houseId: string) => void
}

/** Nhà yến được ghim sao để lên đầu danh sách "Cấu trúc Farm" — chưa có API lưu phía server nên giữ ở localStorage */
export const usePinnedHouseStore = create<PinnedHouseState>()(
  persist(
    (set) => ({
      pinnedByUser: {},
      toggle: (userId, houseId) => set(s => {
        const current = s.pinnedByUser[userId] ?? []
        const next = current.includes(houseId) ? current.filter(id => id !== houseId) : [...current, houseId]
        return { pinnedByUser: { ...s.pinnedByUser, [userId]: next } }
      }),
    }),
    { name: 'swiftletcare-pinned-houses', version: 1 },
  ),
)
