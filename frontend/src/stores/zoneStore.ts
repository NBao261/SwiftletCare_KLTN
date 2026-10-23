import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ZoneState {
  selectedFarmId: string | null
  selectedFarmName: string | null
  selectedZoneId: string | null
  selectedZoneName: string | null
  // Khung lọc Trang trại → Nhà → Zone ở header các trang Farm Owner; '' = tất cả. Lưu lại để chuyển trang không bị trả về
  scopeFarmId: string
  selectedHouseId: string
  scopeZoneId: string
  // Đổi nhà thì Zone về "Tất cả Zone"
  setHouse: (houseId: string) => void
  setScopeZone: (zoneId: string) => void
  // Đổi trang trại ở khung lọc ('' = tất cả): bỏ lọc nhà, Zone; chọn 1 farm thì farm đó thành farm đang xem
  setScopeFarm: (farmId: string, farmName: string) => void
  // Trang chi tiết nhà / Zone ghi phạm vi theo URL để khung lọc khớp trang đang xem ('' = tất cả)
  setScopePath: (farmId: string, farmName: string, houseId: string, zoneId: string) => void
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
      scopeFarmId: '',
      selectedHouseId: '',
      scopeZoneId: '',
      setHouse: houseId => set({ selectedHouseId: houseId, scopeZoneId: '' }),
      setScopeZone: zoneId => set({ scopeZoneId: zoneId }),
      setScopeFarm: (farmId, farmName) =>
        set(farmId
          ? { scopeFarmId: farmId, selectedFarmId: farmId, selectedFarmName: farmName, selectedZoneId: null, selectedZoneName: null, selectedHouseId: '', scopeZoneId: '' }
          : { scopeFarmId: '', selectedHouseId: '', scopeZoneId: '' }),
      setZone: (farmId, farmName, zoneId, zoneName) =>
        set({ selectedFarmId: farmId, selectedFarmName: farmName, selectedZoneId: zoneId, selectedZoneName: zoneName }),
      setScopePath: (farmId, farmName, houseId, zoneId) =>
        set({ scopeFarmId: farmId, selectedFarmId: farmId, selectedFarmName: farmName, selectedHouseId: houseId, scopeZoneId: zoneId }),
      clearZone: () => set({ selectedFarmId: null, selectedFarmName: null, selectedZoneId: null, selectedZoneName: null, scopeFarmId: '', selectedHouseId: '', scopeZoneId: '' }),
    }),
    {
      name: 'swiftletcare-zone',
      version: 2,
      // v0 → v1: thêm selectedFarmId/selectedFarmName. Dữ liệu cũ chỉ có 2 field
      // zone — persist mặc định sẽ merge nông và để farm = null trong khi zone
      // vẫn còn giá trị, khiến các trang gate theo farmId "kẹt" dù UI hiện như
      // đã chọn. Buộc reset cả 2 để user chọn lại từ đầu, nhất quán.
      migrate: (persisted, version) => {
        if (version < 1) return { selectedFarmId: null, selectedFarmName: null, selectedZoneId: null, selectedZoneName: null, scopeFarmId: '', selectedHouseId: '', scopeZoneId: '' }
        // v1 → v2: thêm ô Trang trại, mặc định tất cả trang trại và bỏ lọc nhà, Zone cũ
        if (version < 2) return { ...(persisted as ZoneState), scopeFarmId: '', selectedHouseId: '', scopeZoneId: '' }
        return persisted as ZoneState
      },
    },
  ),
)
