import { describe, expect, it } from 'vitest'
import { restartBlockReason } from '@/lib/deviceCommand'

describe('khởi động lại thiết bị từ xa', () => {
  it('khởi động lại từ xa: chỉ khi đang online và firmware từ 1.4.0, nếu không thì nói rõ lý do', () => {
    expect(restartBlockReason({ status: 'ONLINE', firmware_version: '2.4.0' })).toBeNull()
    expect(restartBlockReason({ status: 'ONLINE', firmware_version: '1.4.0' })).toBeNull()
    expect(restartBlockReason({ status: 'OFFLINE', firmware_version: '2.4.0' })).toContain('mất kết nối')
    expect(restartBlockReason({ status: 'PENDING', firmware_version: '2.4.0' })).toContain('chờ kết nối')
    expect(restartBlockReason({ status: 'ONLINE', firmware_version: '1.3.9' })).toContain('cần từ v1.4.0')
    expect(restartBlockReason({ status: 'ONLINE' })).toContain('chưa báo phiên bản')
  })

})
