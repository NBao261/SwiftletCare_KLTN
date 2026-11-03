import { describe, expect, it } from '@jest/globals'
import { formatFreeHeap, formatUptime, summarizeDeviceStatuses } from '@/utils/device.utils'

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

describe('formatUptime', () => {
  it('lấy đơn vị lớn nhất, chưa có thì gạch dưới', () => {
    const now = new Date('2026-10-31T10:00:00.000Z').getTime()
    expect(formatUptime('2026-10-31T07:00:00.000Z', now)).toBe('3 giờ')
    expect(formatUptime(undefined, now)).toBe('_')
  })
})

describe('formatFreeHeap', () => {
  it('đổi byte sang KB', () => {
    expect(formatFreeHeap(145_408)).toBe('142 KB')
    expect(formatFreeHeap(undefined)).toBe('_')
  })
})
