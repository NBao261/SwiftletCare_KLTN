import { describe, expect, it } from 'vitest'
import { validateCountingSchedule } from '@/validations/common/countingSchedule.validation'

const WINDOWS = { morning: { start: '05:30', end: '07:00' }, evening: { start: '17:30', end: '19:00' } }

describe('validateCountingSchedule', () => {
  it('nhận hồ sơ vắt qua năm mới, ngày 29/02 và khung tạm một ngày', () => {
    const result = validateCountingSchedule({
      profiles: [{ name: 'Mùa đông', from: '11-01', to: '02-29', ...WINDOWS }],
      temporary: [{ from: '2026-11-20', to: '2026-11-20', ...WINDOWS }],
    })
    expect(result).toEqual({ profiles: [null], temporary: [null] })
  })

  it('bắt tên trống, ngày không có thật và khung tạm ngược ngày', () => {
    const result = validateCountingSchedule({
      profiles: [{ name: ' ', from: '01-01', to: '03-31', ...WINDOWS }, { name: 'Hè', from: '02-30', to: '06-30', ...WINDOWS }],
      temporary: [{ from: '2026-11-21', to: '2026-11-20', ...WINDOWS }, { from: '2026-02-30', to: '2026-03-01', ...WINDOWS }],
    })
    expect(result).toEqual({ profiles: ['name', 'monthDay'], temporary: ['dateOrder', 'date'] })
  })

  it('khung bắt đầu trước kết thúc, sáng kết thúc trước chiều', () => {
    const at = (morning: [string, string], evening: [string, string]) => validateCountingSchedule({
      profiles: [],
      temporary: [{ from: '2026-11-20', to: '2026-11-20', morning: { start: morning[0], end: morning[1] }, evening: { start: evening[0], end: evening[1] } }],
    }).temporary[0]
    expect(at(['07:00', '05:30'], ['17:30', '19:00'])).toBe('order')
    expect(at(['05:30', '18:00'], ['17:30', '19:00'])).toBe('morningAfterEvening')
    expect(at(['5:30', '07:00'], ['17:30', '19:00'])).toBe('time')
    expect(at(['05:30', '17:30'], ['17:30', '19:00'])).toBe('morningAfterEvening')
    expect(at(['05:30', '17:29'], ['17:30', '19:00'])).toBeNull()
  })
})
