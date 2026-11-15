import { describe, expect, it } from '@jest/globals'
import {
  appliesMoveOnReconnect,
  formatFreeHeap,
  formatUptime,
  getConfigApplyStep,
  getDeviceActions,
  isWithinRestoreWindow,
  summarizeDeviceStatuses,
} from '@/utils/device.utils'

describe('getDeviceActions', () => {
  it('controller dời, thay, gỡ được; camera chỉ gỡ', () => {
    expect(getDeviceActions('controller')).toEqual(['move', 'replace', 'remove'])
    expect(getDeviceActions('camera')).toEqual(['remove'])
  })
})

describe('appliesMoveOnReconnect', () => {
  it('controller không trực tuyến vẫn dời được, nhận khu vực mới khi kết nối lại', () => {
    expect(appliesMoveOnReconnect('ONLINE')).toBe(false)
    expect(appliesMoveOnReconnect('OFFLINE')).toBe(true)
    expect(appliesMoveOnReconnect('PENDING')).toBe(true)
  })
})

describe('isWithinRestoreWindow', () => {
  const removedAt = '2026-11-12T00:00:00.000Z'
  const removedMs = new Date(removedAt).getTime()
  const hourMs = 60 * 60 * 1000

  it('còn khôi phục được tới đúng 24 giờ, quá thì hết', () => {
    expect(isWithinRestoreWindow(removedAt, removedMs + 23 * hourMs)).toBe(true)
    expect(isWithinRestoreWindow(removedAt, removedMs + 24 * hourMs)).toBe(true)
    expect(isWithinRestoreWindow(removedAt, removedMs + 24 * hourMs + 1)).toBe(false)
  })
})

describe('getConfigApplyStep', () => {
  it('chưa kết nối thì chờ kết nối, dù config_sync còn PENDING', () => {
    expect(getConfigApplyStep(null, undefined)).toBe('waiting-connection')
    expect(getConfigApplyStep('PENDING', 'PENDING')).toBe('waiting-connection')
  })

  it('đã kết nối mà chưa báo đúng phiên bản thì chờ nhận cấu hình', () => {
    expect(getConfigApplyStep('ONLINE', 'PENDING')).toBe('waiting-config')
    expect(getConfigApplyStep('ONLINE', undefined)).toBe('waiting-config')
  })

  it('đang mất kết nối mà chưa áp cấu hình thì chờ kết nối lại, không quay ở bước nhận cấu hình', () => {
    expect(getConfigApplyStep('OFFLINE', 'PENDING')).toBe('waiting-connection')
    expect(getConfigApplyStep('OFFLINE', 'MISMATCH')).toBe('waiting-connection')
    expect(getConfigApplyStep('OFFLINE', undefined)).toBe('waiting-connection')
  })

  it('APPLIED là xong, kể cả khi thiết bị vừa mất kết nối', () => {
    expect(getConfigApplyStep('ONLINE', 'APPLIED')).toBe('applied')
    expect(getConfigApplyStep('OFFLINE', 'APPLIED')).toBe('applied')
  })

  it('tách riêng cấu hình chưa khớp và firmware không báo phiên bản', () => {
    expect(getConfigApplyStep('ONLINE', 'MISMATCH')).toBe('mismatch')
    expect(getConfigApplyStep('ONLINE', 'UNKNOWN')).toBe('unknown')
    expect(getConfigApplyStep('OFFLINE', 'UNKNOWN')).toBe('unknown')
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
