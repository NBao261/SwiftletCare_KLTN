import { create } from 'zustand'

// react-native-mmkv yêu cầu NitroModules (New Architecture build) — không dùng được trong Expo Go.
// Dùng in-memory state; persist sang mmkv khi team có development build.

export type ExpertDateRange = 'today' | '24h' | '7d' | '30d'

export interface ExpertScopeState {
  selectedFarmId: string | null
  selectedHouseId: string | null
  selectedZoneId: string | null
  dateRange: ExpertDateRange
  setFarmId: (farmId: string | null) => void
  setHouseId: (houseId: string | null) => void
  setZoneId: (zoneId: string | null) => void
  setDateRange: (range: ExpertDateRange) => void
  resetScope: () => void
}

export const useExpertScopeStore = create<ExpertScopeState>(set => ({
  selectedFarmId: null,
  selectedHouseId: null,
  selectedZoneId: null,
  dateRange: 'today',

  setFarmId: (farmId: string | null) =>
    set({ selectedFarmId: farmId, selectedHouseId: null, selectedZoneId: null }),

  setHouseId: (houseId: string | null) =>
    set({ selectedHouseId: houseId, selectedZoneId: null }),

  setZoneId: (zoneId: string | null) => set({ selectedZoneId: zoneId }),

  setDateRange: (range: ExpertDateRange) => set({ dateRange: range }),

  resetScope: () =>
    set({ selectedFarmId: null, selectedHouseId: null, selectedZoneId: null, dateRange: 'today' }),
}))
