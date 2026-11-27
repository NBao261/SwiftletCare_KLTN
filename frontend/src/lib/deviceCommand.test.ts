import { describe, expect, it } from 'vitest'
import { restartBlockReason } from '@/lib/deviceCommand'

const say = (code: string, params: { version: string; min: string }) => (code === 'oldFirmware' ? `${code}:${params.version}<${params.min}` : code)

describe('khởi động lại thiết bị từ xa', () => {
  it('chỉ khi đang online và firmware từ 1.4.0, nếu không thì trả mã lý do', () => {
    expect(restartBlockReason({ status: 'ONLINE', firmware_version: '2.4.0' }, say)).toBeNull()
    expect(restartBlockReason({ status: 'ONLINE', firmware_version: '1.4.0' }, say)).toBeNull()
    expect(restartBlockReason({ status: 'OFFLINE', firmware_version: '2.4.0' }, say)).toBe('offline')
    expect(restartBlockReason({ status: 'PENDING', firmware_version: '2.4.0' }, say)).toBe('pending')
    expect(restartBlockReason({ status: 'ONLINE', firmware_version: '1.3.9' }, say)).toBe('oldFirmware:1.3.9<1.4.0')
    expect(restartBlockReason({ status: 'ONLINE' }, say)).toBe('noVersion')
  })
})
