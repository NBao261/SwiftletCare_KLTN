import { describe, expect, it } from '@jest/globals'
import { summarizeDeviceStatuses } from '@/utils/device.utils'

describe('summarizeDeviceStatuses', () => {
  it('đếm riêng online, offline và chờ kết nối', () => {
    expect(summarizeDeviceStatuses(['ONLINE', 'ONLINE', 'OFFLINE', 'PENDING'])).toEqual({
      total: 4,
      online: 2,
      offline: 1,
      pending: 1,
    })
  })

  it('chưa có thiết bị thì mọi số bằng 0', () => {
    expect(summarizeDeviceStatuses([])).toEqual({ total: 0, online: 0, offline: 0, pending: 0 })
  })
})
