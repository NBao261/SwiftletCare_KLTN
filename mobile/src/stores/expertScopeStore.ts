import { create } from 'zustand'

// react-native-mmkv yêu cầu NitroModules (New Architecture build) — không dùng được trong Expo Go.
// Dùng in-memory state; persist sang mmkv khi team có development build.
// Phạm vi chọn của Domain Expert: farm → nhà → tầng. Không có khoảng thời gian vì các endpoint của
// chuyên gia (/alerts, /alerts/verdict-stats, /expert-activity*, /health-reports) không nhận lọc theo ngày.

export interface ExpertScopeState {
  selectedFarmId: string | null
  selectedHouseId: string | null
  selectedZoneId: string | null
  setFarmId: (farmId: string | null) => void
  setHouseId: (houseId: string | null) => void
  setZoneId: (zoneId: string | null) => void
  resetScope: () => void
}

export const useExpertScopeStore = create<ExpertScopeState>(set => ({
  selectedFarmId: null,
  selectedHouseId: null,
  selectedZoneId: null,

  setFarmId: (farmId: string | null) =>
    set({ selectedFarmId: farmId, selectedHouseId: null, selectedZoneId: null }),

  setHouseId: (houseId: string | null) =>
    set({ selectedHouseId: houseId, selectedZoneId: null }),

  setZoneId: (zoneId: string | null) => set({ selectedZoneId: zoneId }),

  resetScope: () =>
    set({ selectedFarmId: null, selectedHouseId: null, selectedZoneId: null }),
}))
