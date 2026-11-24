import { describe, expect, it } from '@jest/globals'
import type { Alert, RelayName, SensorNode } from '@/types'
import {
  buildPumpConfirmMessage,
  countManualRelays,
  getManualRelays,
  getRelayExpiry,
  getRelayMode,
  clampOverrideDuration,
  formatClockTime,
  formatDuration,
  formatRemainingTime,
  formatSpeakerWindows,
  getOverrideDurationLimits,
  getRelayControlErrorMessage,
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

describe('getRelayControlErrorMessage', () => {
  // Lỗi axios tối thiểu: status + mã lỗi trong body như backend trả
  const apiError = (status: number, code?: string) => ({ response: { status, data: { error: { code } } } })

  it('409 CONFIRMATION_REQUIRED lúc bật bơm thì báo cảnh báo chặn bơm', () => {
    expect(getRelayControlErrorMessage(apiError(409, 'CONFIRMATION_REQUIRED'), true)).toBe(
      'Khu vực vừa có cảnh báo chặn bật bơm, vui lòng xem lại',
    )
  })

  it('409 khác (controller đã gỡ) hoặc không phải bật bơm thì dùng câu chung', () => {
    expect(getRelayControlErrorMessage(apiError(409, 'CONFLICT'), true)).toBe('Đã có lỗi xảy ra. Vui lòng thử lại sau')
    expect(getRelayControlErrorMessage(apiError(409, 'CONFIRMATION_REQUIRED'), false)).toBe(
      'Đã có lỗi xảy ra. Vui lòng thử lại sau',
    )
  })

  it('422 thì báo giới hạn thời lượng', () => {
    expect(getRelayControlErrorMessage(apiError(422, 'VALIDATION_ERROR'), false)).toBe(
      'Thời lượng không hợp lệ: bật bơm tối đa 30 phút, còn lại tối đa 24 giờ',
    )
  })
})

const RELAYS: RelayName[] = ['misting', 'ventilation', 'speaker']

function makeNode(overrides: Partial<SensorNode> = {}): SensorNode {
  return {
    _id: 'node-1',
    device_id: 'SC-001',
    zone_id: 'zone-1',
    firmware_version: '1.6.0',
    status: 'ONLINE',
    relay_states: { misting: false, speaker: false, ventilation: false },
    control_mode: 'AUTO',
    ...overrides,
  }
}

describe('getRelayMode / getRelayExpiry (BR-20)', () => {
  it('đọc chế độ và hạn riêng của từng relay', () => {
    const node = makeNode({
      control_mode: 'MANUAL',
      override_expiry: '2026-10-30T10:15:00.000Z',
      relays: {
        misting: { mode: 'MANUAL', override_expiry: '2026-10-30T10:15:00.000Z' },
        ventilation: { mode: 'MANUAL', override_expiry: '2026-10-30T11:00:00.000Z' },
        speaker: { mode: 'AUTO' },
      },
    })
    expect(getRelayMode(node, 'misting')).toBe('MANUAL')
    expect(getRelayMode(node, 'speaker')).toBe('AUTO')
    expect(getRelayExpiry(node, 'ventilation')).toBe('2026-10-30T11:00:00.000Z')
    expect(getRelayExpiry(node, 'speaker')).toBeNull()
  })

  it('controller cũ chưa gửi relays thì dùng chế độ và hạn chung', () => {
    const node = makeNode({ control_mode: 'MANUAL', override_expiry: '2026-10-30T10:30:00.000Z' })
    expect(getRelayMode(node, 'speaker')).toBe('MANUAL')
    expect(getRelayExpiry(node, 'speaker')).toBe('2026-10-30T10:30:00.000Z')
  })

  it('relay MANUAL do thiết bị tự báo không có hạn thì trả null', () => {
    const node = makeNode({ control_mode: 'MANUAL', override_expiry: '2026-10-30T10:30:00.000Z', relays: { misting: { mode: 'MANUAL' } } })
    expect(getRelayExpiry(node, 'misting')).toBeNull()
  })
})

describe('getManualRelays / countManualRelays', () => {
  it('đếm theo relay, không theo controller', () => {
    const first = makeNode({
      control_mode: 'MANUAL',
      relays: { misting: { mode: 'MANUAL' }, ventilation: { mode: 'MANUAL' }, speaker: { mode: 'AUTO' } },
    })
    const second = makeNode({ _id: 'node-2', relays: { misting: { mode: 'AUTO' } } })
    expect(getManualRelays(first, RELAYS)).toEqual(['misting', 'ventilation'])
    expect(countManualRelays([first, second], RELAYS)).toBe(2)
  })
})
