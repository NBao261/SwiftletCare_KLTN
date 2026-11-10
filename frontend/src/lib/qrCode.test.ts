import { describe, expect, it } from 'vitest'
import { deviceLabelCode, zoneCode } from '@/lib/qrCode'

// Định dạng phải khớp Report 3 FARM-FR-010/011 và bộ đọc trên mobile (parseDeviceLabel, parseZoneCode)
describe('qrCode', () => {
  it('nhãn thiết bị chứa đúng device ID và mã kích hoạt', () => {
    const code = deviceLabelCode('node_101', 'K7QM-3XPA-9RTD')
    expect(code).toBe('swiftletcare://claim?d=node_101&k=K7QM-3XPA-9RTD')
    const url = new URL(code)
    expect(url.searchParams.get('d')).toBe('node_101')
    expect(url.searchParams.get('k')).toBe('K7QM-3XPA-9RTD')
  })

  it('mã tầng chỉ chứa zone ID', () => {
    expect(zoneCode('6650a1b2c3d4e5f601234567')).toBe('swiftletcare://zone?z=6650a1b2c3d4e5f601234567')
  })
})
