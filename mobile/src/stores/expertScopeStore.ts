import { create } from 'zustand'
import { createMMKV } from 'react-native-mmkv'

// Khoá lưu trữ MMKV cho phạm vi giám sát của Chuyên gia
const EXPERT_SCOPE_STORAGE_ID = 'swiftletcare.expert.scope'

// Khởi tạo instance MMKV với fallback an toàn cho môi trường test Jest
let mmkvInstance: {
  getString: (key: string) => string | undefined
  set: (key: string, value: string) => void
  remove: (key: string) => boolean
}

try {
  mmkvInstance = createMMKV({ id: EXPERT_SCOPE_STORAGE_ID })
} catch {
  // Bộ nhớ đệm in-memory phục vụ môi trường Jest / Node không có native binding
  const memoryMap = new Map<string, string>()
  mmkvInstance = {
    getString: (key: string) => memoryMap.get(key),
    set: (key: string, value: string) => {
      memoryMap.set(key, value)
    },
    remove: (key: string) => memoryMap.delete(key),
  }
}

export type ExpertDateRange = 'today' | '24h' | '7d' | '30d'

interface PersistedScopeData {
  selectedFarmId: string | null
  selectedHouseId: string | null
  selectedZoneId: string | null
  dateRange: ExpertDateRange
}

const SCOPE_STORAGE_KEY = 'scope_state'

function readPersistedScope(): PersistedScopeData {
  try {
    const raw = mmkvInstance.getString(SCOPE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedScopeData>
      return {
        selectedFarmId: parsed.selectedFarmId ?? null,
        selectedHouseId: parsed.selectedHouseId ?? null,
        selectedZoneId: parsed.selectedZoneId ?? null,
        dateRange: parsed.dateRange ?? 'today',
      }
    }
  } catch {
    // Bỏ qua nếu dữ liệu lưu trữ bị lỗi format
  }
  return {
    selectedFarmId: null,
    selectedHouseId: null,
    selectedZoneId: null,
    dateRange: 'today',
  }
}

function writePersistedScope(data: PersistedScopeData): void {
  try {
    mmkvInstance.set(SCOPE_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Không ném lỗi nếu ghi MMKV thất bại
  }
}

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

const initialScope = readPersistedScope()

/**
 * Store quản lý phạm vi giám sát dùng chung (PersistentScopeBar) cho vai trò Chuyên gia.
 * Sử dụng Zustand v5 kết hợp react-native-mmkv để ghi nhớ đồng bộ tức thì, không làm chậm khởi động.
 */
export const useExpertScopeStore = create<ExpertScopeState>((set, get) => ({
  selectedFarmId: initialScope.selectedFarmId,
  selectedHouseId: initialScope.selectedHouseId,
  selectedZoneId: initialScope.selectedZoneId,
  dateRange: initialScope.dateRange,

  setFarmId: (farmId: string | null) => {
    set({
      selectedFarmId: farmId,
      // Khi đổi trang trại thì reset nhà yến và tầng đã chọn trước đó
      selectedHouseId: null,
      selectedZoneId: null,
    })
    writePersistedScope({
      selectedFarmId: farmId,
      selectedHouseId: null,
      selectedZoneId: null,
      dateRange: get().dateRange,
    })
  },

  setHouseId: (houseId: string | null) => {
    set({
      selectedHouseId: houseId,
      // Khi đổi nhà yến thì reset tầng đã chọn
      selectedZoneId: null,
    })
    writePersistedScope({
      selectedFarmId: get().selectedFarmId,
      selectedHouseId: houseId,
      selectedZoneId: null,
      dateRange: get().dateRange,
    })
  },

  setZoneId: (zoneId: string | null) => {
    set({ selectedZoneId: zoneId })
    writePersistedScope({
      selectedFarmId: get().selectedFarmId,
      selectedHouseId: get().selectedHouseId,
      selectedZoneId: zoneId,
      dateRange: get().dateRange,
    })
  },

  setDateRange: (range: ExpertDateRange) => {
    set({ dateRange: range })
    writePersistedScope({
      selectedFarmId: get().selectedFarmId,
      selectedHouseId: get().selectedHouseId,
      selectedZoneId: get().selectedZoneId,
      dateRange: range,
    })
  },

  resetScope: () => {
    const blank: PersistedScopeData = {
      selectedFarmId: null,
      selectedHouseId: null,
      selectedZoneId: null,
      dateRange: 'today',
    }
    set(blank)
    writePersistedScope(blank)
  },
}))
