import { describe, expect, it } from '@jest/globals'
import type { OnsiteCheck, WorkOrder } from '@/types'
import {
  buildPhotoPart,
  getOwnerWorkOrderActions,
  getReassignCandidates,
  isApprovalUnverified,
  getPendingOnsiteCheck,
  getRemainingPhotoSlots,
  getWorkOrderAction,
  getWorkOrderMilestones,
  hasRecoveryCheck,
  isCauseAlertType,
  isOnsiteCheckAnswered,
  isWorkOrderOpen,
} from '@/utils/workOrder.utils'

describe('isCauseAlertType (ALERT-FR-018)', () => {
  it('chỉ cảnh báo thiết bị phải ghi nguyên nhân tại chỗ; Work Order không gắn cảnh báo thì không bắt buộc', () => {
    expect(isCauseAlertType('MISTING_INEFFECTIVE')).toBe(true)
    expect(isCauseAlertType('ACTUATOR_FAULT')).toBe(true)
    expect(isCauseAlertType('SENSOR_FAULT')).toBe(true)
    expect(isCauseAlertType('RS485_BUS_FAILURE')).toBe(true)
    expect(isCauseAlertType('SPEAKER_FAILURE')).toBe(true)
    expect(isCauseAlertType('NODE_OFFLINE')).toBe(false)
    expect(isCauseAlertType('SENSOR_ANOMALY')).toBe(false)
    expect(isCauseAlertType(null)).toBe(false)
    expect(isCauseAlertType(undefined)).toBe(false)
  })
})

describe('trạng thái Work Order (SM-19)', () => {
  it('còn mở là chưa đóng, chưa huỷ', () => {
    expect(isWorkOrderOpen('OPEN')).toBe(true)
    expect(isWorkOrderOpen('VERIFYING')).toBe(true)
    expect(isWorkOrderOpen('AWAITING_APPROVAL')).toBe(true)
    expect(isWorkOrderOpen('CLOSED')).toBe(false)
    expect(isWorkOrderOpen('CANCELLED')).toBe(false)
  })

  it('người làm chỉ bấm bắt đầu khi OPEN, báo xong khi IN_PROGRESS; các bước sau là của hệ thống và chủ trại', () => {
    expect(getWorkOrderAction('OPEN')).toBe('start')
    expect(getWorkOrderAction('IN_PROGRESS')).toBe('done')
    expect(getWorkOrderAction('VERIFYING')).toBeNull()
    expect(getWorkOrderAction('AWAITING_APPROVAL')).toBeNull()
    expect(getWorkOrderAction('CLOSED')).toBeNull()
  })
})

describe('getPendingOnsiteCheck (EXPERT-FR-021)', () => {
  const request: OnsiteCheck = { requested_at: '2026-11-13T01:00:00.000Z', observation: null }

  it('trả yêu cầu chưa trả lời; đã trả lời hoặc không có yêu cầu thì null', () => {
    expect(getPendingOnsiteCheck({ onsite_checks: [request] })).toBe(request)
    expect(getPendingOnsiteCheck({ onsite_checks: [{ ...request, observation: 'RAIN' }] })).toBeNull()
    expect(getPendingOnsiteCheck({ onsite_checks: [] })).toBeNull()
    expect(getPendingOnsiteCheck({})).toBeNull()
  })

  it('yêu cầu backend trả thiếu khoá observation (bản ghi lúc tạo) vẫn là đang chờ', () => {
    const missingKeys: OnsiteCheck = { requested_at: '2026-11-13T01:00:00.000Z' }
    expect(isOnsiteCheckAnswered(missingKeys)).toBe(false)
    expect(getPendingOnsiteCheck({ onsite_checks: [missingKeys] })).toBe(missingKeys)
  })

  it('có lúc trả lời thì coi là đã trả lời, kể cả khi thiếu observation', () => {
    expect(isOnsiteCheckAnswered({ ...request, answered_at: '2026-11-13T02:00:00.000Z' })).toBe(true)
    expect(isOnsiteCheckAnswered({ ...request, observation: 'NOTHING_UNUSUAL' })).toBe(true)
  })
})

describe('getWorkOrderMilestones (SM-19)', () => {
  const workOrder: WorkOrder = {
    _id: 'wo-1',
    farm_id: 'farm-1',
    house_id: 'house-1',
    kind: 'REPAIR',
    origin: 'ALERT',
    title: 'Bơm không lên nước',
    status: 'VERIFYING',
    opened_at: '2026-11-13T01:00:00.000Z',
    started_at: '2026-11-13T01:10:00.000Z',
    done_at: '2026-11-13T01:40:00.000Z',
    verified_at: null,
  }

  it('chỉ trả các mốc đã xảy ra, theo thứ tự vòng đời', () => {
    expect(getWorkOrderMilestones(workOrder).map(item => item.time)).toEqual([
      '2026-11-13T01:00:00.000Z',
      '2026-11-13T01:10:00.000Z',
      '2026-11-13T01:40:00.000Z',
    ])
  })

  it('chỉ gọi mốc chờ duyệt là dữ liệu đã phục hồi khi hệ thống kiểm được dữ liệu', () => {
    const verified = { ...workOrder, status: 'AWAITING_APPROVAL' as const, verified_at: '2026-11-13T01:55:00.000Z' }
    expect(getWorkOrderMilestones({ ...verified, alert_id: 'alert-1', alert_type: 'MISTING_INEFFECTIVE' })[3].label).toBe(
      'Dữ liệu đã phục hồi',
    )
    expect(getWorkOrderMilestones({ ...verified, alert_id: 'alert-1', alert_type: 'ACTUATOR_FAULT' })[3].label).toBe(
      'Chuyển chờ duyệt',
    )
    expect(getWorkOrderMilestones(verified)[3].label).toBe('Chuyển chờ duyệt')
  })
  it('phiếu phòng ngừa gọi mốc chờ duyệt là chuyển chờ duyệt, không phải dữ liệu đã phục hồi', () => {
    const verifiedAt = '2026-11-13T01:40:00.000Z'
    // Phiếu sửa chữa gắn cảnh báo kiểm được dữ liệu (BR-41); phiếu phòng ngừa cũng gắn MAINTENANCE_DUE nhưng không kiểm
    const repair = {
      ...workOrder, status: 'AWAITING_APPROVAL' as const, verified_at: verifiedAt,
      alert_id: 'alert-1', alert_type: 'MISTING_INEFFECTIVE' as const,
    }
    expect(getWorkOrderMilestones(repair)[3].label).toBe('Dữ liệu đã phục hồi')
    expect(getWorkOrderMilestones({ ...repair, kind: 'PREVENTIVE', origin: 'PLAN' })[3].label).toBe('Chuyển chờ duyệt')
  })
})

describe('hasRecoveryCheck (BR-41)', () => {
  it('chỉ Work Order gắn cảnh báo có dữ liệu để kiểm mới được kiểm phục hồi', () => {
    expect(hasRecoveryCheck({ alert_id: 'alert-1', alert_type: 'SENSOR_FAULT' })).toBe(true)
    expect(hasRecoveryCheck({ alert_id: 'alert-1', alert_type: 'ACTUATOR_FAULT' })).toBe(false)
    expect(hasRecoveryCheck({ alert_id: 'alert-1', alert_type: 'SPEAKER_FAILURE' })).toBe(false)
    expect(hasRecoveryCheck({ alert_id: 'alert-1', alert_type: 'UNEXPECTED_RESTART' })).toBe(false)
    expect(hasRecoveryCheck({ alert_id: null, alert_type: null })).toBe(false)
  })
})

describe('getRemainingPhotoSlots', () => {
  it('trừ ảnh đã gửi ở lần báo xong trước, không xuống dưới 0', () => {
    expect(getRemainingPhotoSlots({})).toBe(5)
    expect(getRemainingPhotoSlots({ photo_urls: ['a', 'b', 'c'] })).toBe(2)
    expect(getRemainingPhotoSlots({ photo_urls: ['a', 'b', 'c', 'd', 'e', 'f'] })).toBe(0)
  })
})

describe('buildPhotoPart', () => {
  it('đặt tên và kiểu ảnh theo đuôi file, mặc định JPEG như ảnh camera', () => {
    expect(buildPhotoPart({ uri: 'file:///cache/a.jpg' }, 'work-order-1')).toEqual({
      uri: 'file:///cache/a.jpg',
      name: 'work-order-1.jpg',
      type: 'image/jpeg',
    })
    expect(buildPhotoPart({ uri: 'file:///cache/b.PNG' }, 'onsite-check').type).toBe('image/png')
    expect(buildPhotoPart({ uri: 'file:///cache/c.webp?x=1' }, 'onsite-check').name).toBe('onsite-check.webp')
    expect(buildPhotoPart({ uri: 'content://media/42' }, 'onsite-check').type).toBe('image/jpeg')
  })
})

describe('getOwnerWorkOrderActions', () => {
  it('chờ duyệt thì duyệt hoặc mở lại', () => {
    expect(getOwnerWorkOrderActions({ status: 'AWAITING_APPROVAL', kind: 'REPAIR' })).toEqual(['approve', 'reopen'])
  })

  it('phiếu sửa chữa mới mở, đang làm: huỷ và giao lại; đang kiểm phục hồi chỉ huỷ', () => {
    expect(getOwnerWorkOrderActions({ status: 'OPEN', kind: 'REPAIR' })).toEqual(['cancel', 'reassign'])
    expect(getOwnerWorkOrderActions({ status: 'IN_PROGRESS', kind: 'REPAIR' })).toEqual(['cancel', 'reassign'])
    expect(getOwnerWorkOrderActions({ status: 'VERIFYING', kind: 'REPAIR' })).toEqual(['cancel'])
  })

  it('phiếu phòng ngừa không huỷ được, vẫn giao lại được', () => {
    expect(getOwnerWorkOrderActions({ status: 'OPEN', kind: 'PREVENTIVE' })).toEqual(['reassign'])
  })

  it('phiếu đã đóng hoặc đã huỷ thì không còn thao tác', () => {
    expect(getOwnerWorkOrderActions({ status: 'CLOSED', kind: 'REPAIR' })).toEqual([])
    expect(getOwnerWorkOrderActions({ status: 'CANCELLED', kind: 'REPAIR' })).toEqual([])
  })
})

describe('isApprovalUnverified', () => {
  it('chờ duyệt mà chưa có mốc xác minh thì chưa xác minh', () => {
    expect(isApprovalUnverified({ status: 'AWAITING_APPROVAL', verified_at: null })).toBe(true)
    expect(isApprovalUnverified({ status: 'AWAITING_APPROVAL', verified_at: '2026-11-19T01:00:00.000Z' })).toBe(false)
    expect(isApprovalUnverified({ status: 'IN_PROGRESS', verified_at: null })).toBe(false)
  })
})

describe('getReassignCandidates', () => {
  it('bỏ người đang giữ phiếu', () => {
    const technicians = [{ userId: 'a' }, { userId: 'b' }]
    expect(getReassignCandidates(technicians, 'a')).toEqual([{ userId: 'b' }])
    expect(getReassignCandidates(technicians, undefined)).toEqual(technicians)
  })
})
