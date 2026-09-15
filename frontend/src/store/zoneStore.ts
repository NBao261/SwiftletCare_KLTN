import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ZoneState {
  selectedZoneId: string | null
  selectedZoneName: string | null
  setZone: (id: string, name: string) => void
  clearZone: () => void
}

/** Zone hiện đang xem — dùng chung giữa DashboardPage và DevicesPage */
export const useZoneStore = create<ZoneState>()(
  persist(
    (set) => ({
      selectedZoneId: null,
      selectedZoneName: null,
      setZone: (id, name) => set({ selectedZoneId: id, selectedZoneName: name }),
      clearZone: () => set({ selectedZoneId: null, selectedZoneName: null }),
    }),
    { name: 'swiftletcare-zone' },
  ),
)
