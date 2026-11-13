// Test logic thuần của wizard cài thiết bị (G-09, FARM-FR-004); đọc nhãn QR test ở lib/qrCode.test.ts
import { describe, it, expect } from 'vitest'
import { canValidateDevice, cameraRegisterInput, sensorRegisterInput } from '@/components/features/technician/onboarding/onboarding.utils'
import type { OnboardingState } from '@/components/features/technician/onboarding/onboardingTypes'

const state = (overrides: Partial<OnboardingState>): OnboardingState => ({
  location: { farmId: 'farm1', houseId: 'house1', zoneId: 'zone1' },
  deviceType: 'SENSOR_NODE',
  deviceId: 'DEV-001',
  secretKey: 'KEY-001',
  deviceDbId: '',
  ...overrides,
})

describe('canValidateDevice — camera cần nhà, bộ điều khiển cần Zone (FARM-FR-004)', () => {
  it('camera: đủ khi có nhà, không cần Zone', () => {
    expect(canValidateDevice(state({ deviceType: 'CAMERA_NODE', location: { farmId: 'farm1', houseId: 'house1' } }))).toBe(true)
    expect(canValidateDevice(state({ deviceType: 'CAMERA_NODE', location: { farmId: 'farm1', zoneId: 'zone1' } }))).toBe(false)
  })

  it('bộ điều khiển: cần Zone', () => {
    expect(canValidateDevice(state({}))).toBe(true)
    expect(canValidateDevice(state({ location: { farmId: 'farm1', houseId: 'house1' } }))).toBe(false)
  })

  it('thiếu mã thiết bị hoặc mã kích hoạt (kể cả chỉ có khoảng trắng) thì chưa xác thực được', () => {
    expect(canValidateDevice(state({ deviceId: '  ' }))).toBe(false)
    expect(canValidateDevice(state({ deviceType: 'CAMERA_NODE', secretKey: '' }))).toBe(false)
  })
})

describe('body đăng ký', () => {
  it('camera gửi house_id, không gửi zone_id', () => {
    const input = cameraRegisterInput(state({ deviceType: 'CAMERA_NODE' }))
    expect(input).toEqual({ device_id: 'DEV-001', house_id: 'house1', secret_key: 'KEY-001' })
    expect(input).not.toHaveProperty('zone_id')
  })

  it('bộ điều khiển gửi zone_id; bỏ khoảng trắng hai đầu mã', () => {
    expect(sensorRegisterInput(state({ deviceId: '  DEV-001  ', secretKey: ' KEY-001 ' })))
      .toEqual({ device_id: 'DEV-001', zone_id: 'zone1', secret_key: 'KEY-001' })
  })
})
