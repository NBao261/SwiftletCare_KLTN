import { describe, expect, it } from 'vitest'

import { notificationTarget } from '@/constants/notificationTargets'
import type { NotificationRefKind } from '@/types'

const of = (kind: NotificationRefKind, id = 'x1') => ({ ref: { kind, id } })

describe('notificationTarget (EXPERT-FR-007, todo-audit-1118 W-03)', () => {
  it('cảnh báo: chuyên gia mở màn kết luận, Farm Owner mở trang Cảnh báo', () => {
    expect(notificationTarget(of('alert', 'a1'), 'DOMAIN_EXPERT')).toEqual({ path: '/domain-expert/alert-verdicts?alertId=a1' })
    expect(notificationTarget(of('alert', 'a1'), 'FARM_OWNER')).toEqual({ path: '/alerts?highlight=a1' })
  })

  it('báo cáo sức khỏe mở trang báo cáo qua history state, không đưa id lên URL', () => {
    expect(notificationTarget(of('health_report', 'r1'), 'FARM_OWNER')).toEqual({ path: '/health/report', state: { reportId: 'r1' } })
  })

  it('mục duyệt, đề xuất, lịch sử quyết định mở khu chuyên gia khi role vào được', () => {
    expect(notificationTarget(of('parameter_review'), 'DOMAIN_EXPERT')).toEqual({ path: '/domain-expert/reviews' })
    expect(notificationTarget(of('coefficient_proposal'), 'DOMAIN_EXPERT')).toEqual({ path: '/domain-expert/reviews' })
    expect(notificationTarget(of('expert_decision'), 'DOMAIN_EXPERT')).toEqual({ path: '/domain-expert/history' })
  })

  it('role không vào được trang đích thì chỉ đánh dấu đã đọc (null), không đưa về /403', () => {
    expect(notificationTarget(of('work_order'), 'FARM_TECHNICIAN')).toBeNull()
    expect(notificationTarget(of('health_day'), 'ADMIN')).toBeNull()
  })

  it('Work Order, thao tác thiết bị, ngày đánh giá', () => {
    expect(notificationTarget(of('work_order'), 'FARM_OWNER')).toEqual({ path: '/work-orders' })
    expect(notificationTarget(of('device_action'), 'FARM_OWNER')).toEqual({ path: '/devices' })
    expect(notificationTarget(of('health_day'), 'FARM_OWNER')).toEqual({ path: '/health' })
  })

  it('không có ref: Administrator mở yêu cầu tài khoản, role khác không mở trang nào', () => {
    expect(notificationTarget({ ref: null }, 'ADMIN')).toEqual({ path: '/account-requests' })
    expect(notificationTarget({ ref: null }, 'FARM_OWNER')).toBeNull()
  })
})
