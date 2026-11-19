import { describe, expect, it } from 'vitest'
import { ownShiftLines } from '@/components/features/technician/farms/ownShifts'

const t = (key: string) => key

describe('ownShiftLines (AUTH-FR-014)', () => {
  it('xếp ngày từ thứ Hai, Chủ nhật cuối; ghi loại ca', () => {
    expect(ownShiftLines([{ technician_id: 'u', role: 'PRIMARY', weekdays: [0, 3, 1], start: '06:00', end: '18:00' }], t))
      .toEqual(['roster.day.1, roster.day.3, roster.day.0 · 06:00–18:00 · roster.role.PRIMARY'])
  })

  it('ca qua nửa đêm có chữ "qua đêm"; nhiều ca thì nhiều dòng', () => {
    expect(ownShiftLines([
      { technician_id: 'u', role: 'BACKUP', weekdays: [5], start: '18:00', end: '06:00' },
      { technician_id: 'u', role: 'PRIMARY', weekdays: [6], start: '08:00', end: '12:00' },
    ], t)).toEqual([
      'roster.day.5 · 18:00–06:00 (roster.overnight) · roster.role.BACKUP',
      'roster.day.6 · 08:00–12:00 · roster.role.PRIMARY',
    ])
  })

  it('không có ca thì không có dòng nào', () => {
    expect(ownShiftLines([], t)).toEqual([])
  })
})
