import { describe, expect, it } from 'vitest'
import { deviceLabelCode, parseDeviceLabelCode, zoneCode } from '@/lib/qrCode'

// Định dạng phải khớp Report 3 FARM-FR-010/011 và bộ đọc trên mobile (parseDeviceLabel, parseZoneCode)
describe('qrCode', () => {
  it('nhãn thiết bị chứa đúng device ID và mã kích hoạt', () => {
    const code = deviceLabelCode('node_101', 'K7QM-3XPA-9RTD')
    expect(code).toBe('swiftletcare://claim?d=node_101&k=K7QM-3XPA-9RTD')
    const url = new URL(code)
    expect(url.searchParams.get('d')).toBe('node_101')
    expect(url.searchParams.get('k')).toBe('K7QM-3XPA-9RTD')
  })

  it('đọc lại nhãn thiết bị đã sinh; bỏ khoảng trắng hai đầu', () => {
    expect(parseDeviceLabelCode(deviceLabelCode('node_101', 'K7QM-3XPA-9RTD'))).toEqual({ deviceId: 'node_101', secretKey: 'K7QM-3XPA-9RTD' })
    expect(parseDeviceLabelCode('  swiftletcare://claim?d=DEV-001&k=KEY-001  ')).toEqual({ deviceId: 'DEV-001', secretKey: 'KEY-001' })
  })

  it('không phải nhãn thiết bị hoặc thiếu d/k thì null', () => {
    expect(parseDeviceLabelCode('not-a-uri')).toBeNull()
    expect(parseDeviceLabelCode('swiftletcare://zone?z=6650a1b2c3d4e5f601234567')).toBeNull()
    expect(parseDeviceLabelCode('https://example.com/claim?d=DEV-001&k=KEY-001')).toBeNull()
    expect(parseDeviceLabelCode('swiftletcare://claim?d=DEV-001')).toBeNull()
    expect(parseDeviceLabelCode('swiftletcare://claim?k=KEY-001')).toBeNull()
  })

  it('mã tầng chỉ chứa zone ID', () => {
    expect(zoneCode('6650a1b2c3d4e5f601234567')).toBe('swiftletcare://zone?z=6650a1b2c3d4e5f601234567')
  })
})
