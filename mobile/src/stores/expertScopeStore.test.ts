import { describe, expect, it, beforeEach } from '@jest/globals'
import { useExpertScopeStore } from '@/stores/expertScopeStore'

// Store thuần in-memory (không dùng MMKV) nên không cần mock native binding nào

describe('useExpertScopeStore', () => {
  beforeEach(() => {
    useExpertScopeStore.getState().resetScope()
  })

  it('khởi tạo với giá trị mặc định', () => {
    const state = useExpertScopeStore.getState()
    expect(state.selectedFarmId).toBeNull()
    expect(state.selectedHouseId).toBeNull()
    expect(state.selectedZoneId).toBeNull()
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
})
