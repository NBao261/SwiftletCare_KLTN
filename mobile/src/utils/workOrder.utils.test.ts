import { describe, expect, it } from '@jest/globals'
import type { OnsiteCheck } from '@/types'
import {
  buildPhotoPart,
  getPendingOnsiteCheck,
  getWorkOrderAction,
  isCauseAlertType,
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
