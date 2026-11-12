import { describe, expect, it } from '@jest/globals'
import { formatFreeHeap, formatUptime, getConfigApplyStep, summarizeDeviceStatuses } from '@/utils/device.utils'

describe('getConfigApplyStep', () => {
  it('chưa kết nối thì chờ kết nối, dù config_sync còn PENDING', () => {
    expect(getConfigApplyStep(null, undefined)).toBe('waiting-connection')
    expect(getConfigApplyStep('PENDING', 'PENDING')).toBe('waiting-connection')
  })

  it('đã kết nối mà chưa báo đúng phiên bản thì chờ nhận cấu hình', () => {
    expect(getConfigApplyStep('ONLINE', 'PENDING')).toBe('waiting-config')
    expect(getConfigApplyStep('OFFLINE', undefined)).toBe('waiting-config')
  })

  it('APPLIED là xong, kể cả khi thiết bị vừa mất kết nối', () => {
    expect(getConfigApplyStep('ONLINE', 'APPLIED')).toBe('applied')
    expect(getConfigApplyStep('OFFLINE', 'APPLIED')).toBe('applied')
  })

  it('tách riêng cấu hình chưa khớp và firmware không báo phiên bản', () => {
    expect(getConfigApplyStep('ONLINE', 'MISMATCH')).toBe('mismatch')
    expect(getConfigApplyStep('ONLINE', 'UNKNOWN')).toBe('unknown')
  })
})

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
