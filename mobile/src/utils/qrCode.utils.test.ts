import { describe, expect, it } from '@jest/globals'
import { parseDeviceLabel, parseZoneCode } from '@/utils/qrCode.utils'

describe('parseDeviceLabel', () => {
  it('đọc đúng mã thiết bị và mã kích hoạt trên nhãn', () => {
    expect(parseDeviceLabel('swiftletcare://claim?d=node_002&k=DEMO-NODE-0002')).toEqual({
      deviceId: 'node_002',
      activationKey: 'DEMO-NODE-0002',
    })
  })

  it('bỏ khoảng trắng thừa, giải mã ký tự đã mã hoá', () => {
    expect(parseDeviceLabel('  swiftletcare://claim?k=A%2BB&d=cam_001 ')).toEqual({
      deviceId: 'cam_001',
      activationKey: 'A+B',
    })
  })

  it('thiếu mã kích hoạt, sai tiền tố hoặc mã hỏng thì null', () => {
    expect(parseDeviceLabel('swiftletcare://claim?d=node_002')).toBeNull()
    expect(parseDeviceLabel('https://example.com/claim?d=a&k=b')).toBeNull()
    expect(parseDeviceLabel('swiftletcare://zone?z=zone-1')).toBeNull()
    expect(parseDeviceLabel('swiftletcare://claim?d=%E0&k=b')).toBeNull()
  })
})

describe('parseZoneCode', () => {
  it('đọc mã zone trên mã tầng', () => {
    expect(parseZoneCode('swiftletcare://zone?z=665f1c2e9a1b2c3d4e5f6a7b')).toBe('665f1c2e9a1b2c3d4e5f6a7b')
  })

  it('không phải mã tầng thì null', () => {
    expect(parseZoneCode('swiftletcare://claim?d=a&k=b')).toBeNull()
    expect(parseZoneCode('swiftletcare://zone?z=')).toBeNull()
  })
})
