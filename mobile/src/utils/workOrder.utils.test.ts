import { describe, expect, it } from '@jest/globals'
import type { OnsiteCheck, WorkOrder } from '@/types'
import {
  buildPhotoPart,
  getPendingOnsiteCheck,
  getWorkOrderAction,
  getWorkOrderMilestones,
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
