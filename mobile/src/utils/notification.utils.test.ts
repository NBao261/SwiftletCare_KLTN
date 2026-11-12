import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { InAppNotification } from '@/types'
import {
  affectsAlerts,
  createRecentIdSet,
  createTrailingRunner,
  findNotificationInPages,
  getNotificationTarget,
  getPushTarget,
  markReadInPages,
  type NotificationPages,
  prependNotification,
} from '@/utils/notification.utils'

// Thông báo tối thiểu cho test
function buildNotification(id: string, overrides: Partial<InAppNotification> = {}): InAppNotification {
  return {
    _id: id,
    title: 'Tiêu đề',
    body: 'Nội dung',
    ref: null,
    read_at: null,
    created_at: '2026-11-11T01:00:00.000Z',
    ...overrides,
  }
}

// Hai trang cache như useNotifications
function buildPages(): NotificationPages {
  return {
    pages: [
      { data: [buildNotification('n2'), buildNotification('n1', { read_at: '2026-11-11T02:00:00.000Z' })], meta: { total: 3 } },
      { data: [buildNotification('n0')], meta: { total: 3 } },
    ],
    pageParams: [1, 2],
  }
}

describe('getNotificationTarget', () => {
  it('cảnh báo mở cảnh báo, báo cáo mở báo cáo, còn lại mở trang chi tiết', () => {
    expect(getNotificationTarget(buildNotification('a', { ref: { kind: 'alert', id: 'alert-1' } }))).toEqual({
      kind: 'alert',
      alertId: 'alert-1',
    })
    expect(getNotificationTarget(buildNotification('b', { ref: { kind: 'health_report', id: 'report-1' } }))).toEqual({
      kind: 'report',
      reportId: 'report-1',
    })
    expect(getNotificationTarget(buildNotification('c', { ref: { kind: 'expert_decision', id: 'audit-1' } }))).toEqual({
      kind: 'detail',
      notificationId: 'c',
    })
    expect(getNotificationTarget(buildNotification('d'))).toEqual({ kind: 'detail', notificationId: 'd' })
  })

  it('quyết định của chuyên gia và cảnh báo làm tải lại cảnh báo, báo cáo thì không', () => {
    expect(affectsAlerts(buildNotification('a', { ref: { kind: 'expert_decision', id: 'x' } }))).toBe(true)
    expect(affectsAlerts(buildNotification('b', { ref: { kind: 'alert', id: 'x' } }))).toBe(true)
    expect(affectsAlerts(buildNotification('c', { ref: { kind: 'health_report', id: 'x' } }))).toBe(false)
    expect(affectsAlerts(buildNotification('d'))).toBe(false)
  })
})

describe('cache thông báo', () => {
  it('tìm thấy thông báo ở mọi trang, không có thì null', () => {
    expect(findNotificationInPages(buildPages(), 'n0')?._id).toBe('n0')
    expect(findNotificationInPages(buildPages(), 'khong-co')).toBeNull()
    expect(findNotificationInPages(undefined, 'n0')).toBeNull()
  })

  it('chèn thông báo mới lên đầu trang 1 và tăng total; đã có thì giữ nguyên', () => {
    const pages = buildPages()
    const next = prependNotification(pages, buildNotification('n3'))
    expect(next?.pages[0].data.map(notification => notification._id)).toEqual(['n3', 'n2', 'n1'])
    expect(next?.pages[0].meta?.total).toBe(4)
    expect(prependNotification(pages, buildNotification('n1'))).toBe(pages)
    expect(prependNotification(undefined, buildNotification('n3'))).toBeUndefined()
  })

  it('đánh dấu đã đọc một thông báo hoặc tất cả, giữ thời điểm đọc cũ', () => {
    const readAt = '2026-11-11T05:00:00.000Z'
    const one = markReadInPages(buildPages(), 'n2', readAt)
    expect(one?.pages[0].data[0].read_at).toBe(readAt)
    expect(one?.pages[1].data[0].read_at).toBeNull()
    const all = markReadInPages(buildPages(), null, readAt)
    expect(all?.pages.flatMap(page => page.data).every(notification => notification.read_at !== null)).toBe(true)
    expect(all?.pages[0].data[1].read_at).toBe('2026-11-11T02:00:00.000Z')
  })
})

describe('createRecentIdSet', () => {
  it('nhớ id vừa nhận, quên id cũ nhất khi vượt giới hạn, xoá hết khi clear', () => {
    const recent = createRecentIdSet(2)
    recent.add('a')
    recent.add('b')
    recent.add('c')
    expect(recent.has('a')).toBe(false)
    expect(recent.has('c')).toBe(true)
    recent.clear()
    expect(recent.has('c')).toBe(false)
  })
})

describe('createTrailingRunner', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('nhiều lần gọi dồn dập chỉ chạy một lần ở cuối; huỷ thì không chạy', () => {
    const run = jest.fn()
    const runner = createTrailingRunner(run, 400)
    runner.schedule()
    jest.advanceTimersByTime(300)
    runner.schedule()
    runner.schedule()
    jest.advanceTimersByTime(399)
    expect(run).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
    runner.schedule()
    runner.cancel()
    jest.advanceTimersByTime(400)
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('getPushTarget', () => {
  it('push cảnh báo mở cảnh báo, push báo cáo mở báo cáo, còn lại hoặc data lạ thì mở chuông', () => {
    expect(getPushTarget({ kind: 'alert', id: 'alert-1' })).toEqual({ kind: 'alert', alertId: 'alert-1' })
    expect(getPushTarget({ kind: 'health_report', id: 'report-1' })).toEqual({ kind: 'report', reportId: 'report-1' })
    expect(getPushTarget({ kind: 'expert_decision', id: 'audit-1' })).toEqual({ kind: 'bell' })
    expect(getPushTarget({ kind: 'alert' })).toEqual({ kind: 'bell' })
    expect(getPushTarget(null)).toEqual({ kind: 'bell' })
  })
})
