import { describe, expect, it } from 'vitest'

import { isDeviceSetupState } from '@/components/features/farm-owner/onboarding/deviceSetupState'

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
