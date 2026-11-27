import { describe, expect, it } from 'vitest'
import { deviceIdError, isActivationKeyTooLong } from '@/validations/common/deviceId.validation'

describe('deviceIdError', () => {
  it.each(['node_101', 'ESP32-A7F3-001', ' node_1 ', 'a'.repeat(40)])('%j hợp lệ', id => {
    expect(deviceIdError(id)).toBeUndefined()
  })

  it('báo trống, quá dài và ký tự lạ', () => {
    expect(deviceIdError('  ')).toBe('Chưa nhập mã thiết bị')
    expect(deviceIdError('a'.repeat(41))).toBe('Mã thiết bị tối đa 40 ký tự')
    for (const id of ['bad id', 'a/b', 'a+b', 'a#b', 'nút_1']) {
      expect(deviceIdError(id)).toBe('Mã thiết bị chỉ gồm chữ, số, dấu _ và -')
    }
  })
})

describe('isActivationKeyTooLong', () => {
  it('quá 128 ký tự thì báo', () => {
    expect(isActivationKeyTooLong('k'.repeat(128))).toBe(false)
    expect(isActivationKeyTooLong('k'.repeat(129))).toBe(true)
  })
})
