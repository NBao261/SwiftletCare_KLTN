import { describe, expect, it } from 'vitest'
import { validateCountingSchedule } from '@/validations/domain-expert/countingSchedule.validation'

const WINDOWS = { morning: { start: '05:30', end: '07:00' }, evening: { start: '17:30', end: '19:00' } }

describe('validateCountingSchedule', () => {
  it('nhận hồ sơ vắt qua năm mới, ngày 29/02 và khung tạm một ngày', () => {
    const result = validateCountingSchedule({
      profiles: [{ name: 'Mùa đông', from: '11-01', to: '02-29', ...WINDOWS }],
      temporary: [{ from: '2026-11-20', to: '2026-11-20', ...WINDOWS }],
    })
    expect(result).toEqual({ profiles: [null], temporary: [null], defaults: null })
  })

  it('bắt tên trống, ngày không có thật và khung tạm ngược ngày', () => {
    const result = validateCountingSchedule({
      profiles: [{ name: ' ', from: '01-01', to: '03-31', ...WINDOWS }, { name: 'Hè', from: '02-30', to: '06-30', ...WINDOWS }],
      temporary: [{ from: '2026-11-21', to: '2026-11-20', ...WINDOWS }, { from: '2026-02-30', to: '2026-03-01', ...WINDOWS }],
    })
    expect(result).toEqual({ profiles: ['name', 'monthDay'], temporary: ['dateOrder', 'date'], defaults: null })
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

  it('dòng trùng ngày với dòng phía trên báo overlap, như backend trả 400', () => {
    const result = validateCountingSchedule({
      profiles: [
        { name: 'Mùa mưa', from: '09-01', to: '01-14', ...WINDOWS },
        { name: 'Đầu năm', from: '01-10', to: '02-28', ...WINDOWS },
        { name: 'Mùa khô', from: '03-01', to: '08-31', ...WINDOWS },
      ],
      temporary: [
        { from: '2026-11-20', to: '2026-11-22', ...WINDOWS },
        { from: '2026-11-22', to: '2026-11-23', ...WINDOWS },
        { from: '2026-11-24', to: '2026-11-24', ...WINDOWS },
      ],
    })
    expect(result).toEqual({ profiles: [null, 'overlap', null], temporary: [null, 'overlap', null], defaults: null })
  })

  it('một hồ sơ cả năm không tự chồng chính nó', () => {
    expect(validateCountingSchedule({ profiles: [{ name: 'Cả năm', from: '01-01', to: '12-31', ...WINDOWS }], temporary: [] }).profiles).toEqual([null])
  })
})

describe('khung mặc định của nhà', () => {
  it('không đặt thì không có lỗi; đặt sai thứ tự thì báo như mọi khung', () => {
    expect(validateCountingSchedule({ profiles: [], temporary: [] }).defaults).toBeNull()
    expect(validateCountingSchedule({ profiles: [], temporary: [], default_windows: WINDOWS }).defaults).toBeNull()
    const crossing = { morning: { start: '05:00', end: '18:00' }, evening: { start: '17:30', end: '19:00' } }
    expect(validateCountingSchedule({ profiles: [], temporary: [], default_windows: crossing }).defaults).toBe('morningAfterEvening')
  })
})
