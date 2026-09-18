import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ZoneState {
  selectedFarmId: string | null
  selectedFarmName: string | null
  selectedZoneId: string | null
  selectedZoneName: string | null
  /**
   * Farm luôn đi kèm Zone vì chọn Zone là đi qua cascade Farm→House→Zone — biết
   * sẵn farmId lúc đó tránh các trang khác (Harvest/Ticket/Analytics So sánh
   * Zone) phải bắt người dùng chọn lại farm từ đầu.
   */
  setZone: (farmId: string, farmName: string, zoneId: string, zoneName: string) => void
  clearZone: () => void
}

/** Farm/Zone hiện đang xem — dùng chung giữa Dashboard, Devices, Harvest, Tickets, Analytics */
export const useZoneStore = create<ZoneState>()(
  persist(
    (set) => ({
      selectedFarmId: null,
      selectedFarmName: null,
      selectedZoneId: null,
      selectedZoneName: null,
      setZone: (farmId, farmName, zoneId, zoneName) =>
        set({ selectedFarmId: farmId, selectedFarmName: farmName, selectedZoneId: zoneId, selectedZoneName: zoneName }),
      clearZone: () => set({ selectedFarmId: null, selectedFarmName: null, selectedZoneId: null, selectedZoneName: null }),
    }),
    {
      name: 'swiftletcare-zone',
      version: 1,
      // v0 → v1: thêm selectedFarmId/selectedFarmName. Dữ liệu cũ chỉ có 2 field
      // zone — persist mặc định sẽ merge nông và để farm = null trong khi zone
      // vẫn còn giá trị, khiến các trang gate theo farmId "kẹt" dù UI hiện như
      // đã chọn. Buộc reset cả 2 để user chọn lại từ đầu, nhất quán.
      migrate: (persisted, version) => {
        if (version < 1) return { selectedFarmId: null, selectedFarmName: null, selectedZoneId: null, selectedZoneName: null }
        return persisted as ZoneState
      },
    },
  ),
)
