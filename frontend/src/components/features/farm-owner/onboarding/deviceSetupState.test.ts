import { describe, expect, it } from 'vitest'

import { clearSetupProgress, isDeviceSetupState, loadSetupProgress, saveSetupProgress, type SetupProgress } from '@/components/features/farm-owner/onboarding/deviceSetupState'

describe('vị trí truyền từ trang Zone sang thiết lập thiết bị', () => {
  it('nhận khi có đủ trang trại, nhà và Zone', () => {
    expect(isDeviceSetupState({ location: { farmId: 'f1', houseId: 'h1', zoneId: 'z1' } })).toBe(true)
  })

  it('bỏ qua khi thiếu một cấp hoặc không có state (mở thẳng từ trang Thiết bị)', () => {
    expect(isDeviceSetupState(null)).toBe(false)
    expect(isDeviceSetupState({})).toBe(false)
    expect(isDeviceSetupState({ location: { farmId: 'f1', houseId: 'h1' } })).toBe(false)
    expect(isDeviceSetupState({ fromChildPage: true })).toBe(false)
  })
})

describe('giữ tiến trình thiết lập khi tải lại trang', () => {
  const progress: SetupProgress = {
    userId: 'u1', step: 2, deviceType: 'SENSOR_NODE', location: { farmId: 'f1', houseId: 'h1', zoneId: 'z1' },
    deviceId: 'node_100', deviceDbId: 'db1', returnTo: '/farms/f1/houses/h1/zones/z1',
  }

  function memoryStorage() {
    const store = new Map<string, string>()
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    }
  }

  it('lưu rồi đọc lại đúng, xoá thì mất', () => {
    const storage = memoryStorage()
    saveSetupProgress(progress, storage)
    expect(loadSetupProgress('u1', storage)).toEqual(progress)
    clearSetupProgress(storage)
    expect(loadSetupProgress('u1', storage)).toBeUndefined()
  })

  it('không đọc dữ liệu hỏng, thiếu thiết bị đã đăng ký, hoặc kho bị chặn', () => {
    const storage = memoryStorage()
    storage.setItem('swiftletcare.deviceSetupProgress', '{không phải json')
    expect(loadSetupProgress('u1', storage)).toBeUndefined()
    saveSetupProgress({ ...progress, deviceDbId: '' }, storage)
    expect(loadSetupProgress('u1', storage)).toBeUndefined()
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(loadSetupProgress('u1', blocked)).toBeUndefined()
    expect(() => saveSetupProgress(progress, blocked)).not.toThrow()
  })

  it('không trả tiến trình của người dùng khác trong cùng tab, hay khi chưa biết người dùng', () => {
    const storage = memoryStorage()
    saveSetupProgress(progress, storage)
    expect(loadSetupProgress('u2', storage)).toBeUndefined()
    expect(loadSetupProgress(undefined, storage)).toBeUndefined()
  })
})
