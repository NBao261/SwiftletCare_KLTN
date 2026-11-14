import { describe, expect, it, beforeEach, jest } from '@jest/globals'
import { useExpertScopeStore } from '@/stores/expertScopeStore'

// Mock react-native-mmkv cho môi trường Jest (không có NitroModules native binding)
const mockStorage = new Map<string, string>()
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string) => {
      mockStorage.set(key, value)
    },
    remove: (key: string) => mockStorage.delete(key),
    contains: (key: string) => mockStorage.has(key),
    clearAll: () => mockStorage.clear(),
  }),
}))

describe('useExpertScopeStore', () => {
  beforeEach(() => {
    mockStorage.clear()
    useExpertScopeStore.getState().resetScope()
  })

  it('khởi tạo với giá trị mặc định', () => {
    const state = useExpertScopeStore.getState()
    expect(state.selectedFarmId).toBeNull()
    expect(state.selectedHouseId).toBeNull()
    expect(state.selectedZoneId).toBeNull()
    expect(state.dateRange).toBe('today')
  })

  it('cập nhật farmId thì reset houseId và zoneId', () => {
    const store = useExpertScopeStore.getState()
    store.setHouseId('house-1')
    store.setZoneId('zone-1')
    store.setFarmId('farm-new')

    const updated = useExpertScopeStore.getState()
    expect(updated.selectedFarmId).toBe('farm-new')
    expect(updated.selectedHouseId).toBeNull()
    expect(updated.selectedZoneId).toBeNull()
  })

  it('cập nhật houseId thì reset zoneId', () => {
    const store = useExpertScopeStore.getState()
    store.setFarmId('farm-1')
    store.setZoneId('zone-1')
    store.setHouseId('house-new')

    const updated = useExpertScopeStore.getState()
    expect(updated.selectedFarmId).toBe('farm-1')
    expect(updated.selectedHouseId).toBe('house-new')
    expect(updated.selectedZoneId).toBeNull()
  })

  it('cập nhật dateRange thành công', () => {
    const store = useExpertScopeStore.getState()
    store.setDateRange('7d')

    const updated = useExpertScopeStore.getState()
    expect(updated.dateRange).toBe('7d')
  })
})
