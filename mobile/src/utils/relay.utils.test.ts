import { describe, expect, it } from '@jest/globals'
import type { Alert } from '@/types'
import {
  buildPumpConfirmMessage,
  clampOverrideDuration,
  formatClockTime,
  formatDuration,
  formatRemainingTime,
  formatSpeakerWindows,
  getOverrideDurationLimits,
} from '@/utils/relay.utils'

const now = new Date('2026-10-30T10:00:00.000Z').getTime()

describe('formatRemainingTime', () => {
  it('dưới 1 giờ thì ghi số phút', () => {
    expect(formatRemainingTime('2026-10-30T10:18:30.000Z', now)).toBe('còn 18 phút')
  })

  it('từ 1 giờ thì ghi giờ và phút', () => {
    expect(formatRemainingTime('2026-10-30T12:05:00.000Z', now)).toBe('còn 2 giờ 5 phút')
    expect(formatRemainingTime('2026-10-30T12:00:00.000Z', now)).toBe('còn 2 giờ')
  })

  it('dưới 1 phút và đã hết hạn', () => {
    expect(formatRemainingTime('2026-10-30T10:00:40.000Z', now)).toBe('còn dưới 1 phút')
    expect(formatRemainingTime('2026-10-30T09:59:00.000Z', now)).toBeNull()
  })
})

describe('getOverrideDurationLimits', () => {
  it('bật bơm tối đa 30 phút, tắt bơm và quạt tối đa 24 giờ (BR-08)', () => {
    expect(getOverrideDurationLimits('misting', true)).toEqual({ minMs: 60_000, maxMs: 30 * 60_000 })
    expect(getOverrideDurationLimits('misting', false).maxMs).toBe(24 * 3_600_000)
    expect(getOverrideDurationLimits('ventilation', true).maxMs).toBe(24 * 3_600_000)
  })
})

describe('clampOverrideDuration', () => {
  it('kẹp vào khoảng cho phép', () => {
    const limits = getOverrideDurationLimits('misting', true)
    expect(clampOverrideDuration(3_600_000, limits)).toBe(30 * 60_000)
    expect(clampOverrideDuration(1000, limits)).toBe(60_000)
    expect(clampOverrideDuration(15 * 60_000, limits)).toBe(15 * 60_000)
  })
})

describe('formatDuration', () => {
  it('ghi phút, giờ, giờ và phút', () => {
    expect(formatDuration(5 * 60_000)).toBe('5 phút')
    expect(formatDuration(3_600_000)).toBe('1 giờ')
    expect(formatDuration(90 * 60_000)).toBe('1 giờ 30 phút')
  })
})

describe('formatClockTime', () => {
  it('đổi sang giờ Việt Nam', () => {
    expect(formatClockTime('2026-10-30T07:05:00.000Z')).toBe('14:05')
  })
})

describe('formatSpeakerWindows', () => {
  it('nối các khung giờ, tắt lịch thì null', () => {
    const windows = [
      { start: '05:00', end: '07:00' },
      { start: '17:00', end: '19:00' },
    ]
    expect(formatSpeakerWindows({ enabled: true, windows })).toBe('05:00–07:00 · 17:00–19:00')
    expect(formatSpeakerWindows({ enabled: false, windows })).toBeNull()
    expect(formatSpeakerWindows(undefined)).toBeNull()
  })
})

describe('buildPumpConfirmMessage', () => {
  it('liệt kê từng cảnh báo đang mở với trạng thái, rồi hỏi kèm thời lượng (ENV-FR-016)', () => {
    const base: Alert = {
      _id: 'a',
      farm_id: 'farm-1',
      type: 'SENSOR_FAULT',
      severity: 'MEDIUM',
      title: '',
      message: '',
      status: 'ACKNOWLEDGED',
      created_at: '2026-11-03T00:00:00.000Z',
    }
    const message = buildPumpConfirmMessage([base, { ...base, _id: 'b', type: 'MISTING_INEFFECTIVE', status: 'ACTIVE' }], 15 * 60_000)
    expect(message.split('\n')).toEqual([
      'Khu vực đang có cảnh báo:',
      '• Lỗi cảm biến · Đã xác nhận',
      '• Phun sương không hiệu quả · Mới',
      '',
      'Bơm có thể chạy không đúng. Vẫn bật bơm trong 15 phút?',
    ])
  })
})

describe('buildPumpConfirmMessage từ error.details', () => {
  it('cảnh báo không có trạng thái thì chỉ ghi loại', () => {
    const message = buildPumpConfirmMessage([{ _id: 'a', type: 'RS485_BUS_FAILURE', title: '' }], 30 * 60_000)
    expect(message.split('\n')[1]).toBe('• Lỗi bus cảm biến')
  })
})
