import { describe, expect, it } from 'vitest'
import { isOvernightShift, validateRosterShift } from '@/validations/farm-owner/roster.validation'
import type { RosterShift } from '@/types'

const shift = (input: Partial<RosterShift>): RosterShift => ({ technician_id: 'a', role: 'PRIMARY', weekdays: [1], start: '06:00', end: '18:00', ...input })

describe('validateRosterShift (AUTH-FR-014)', () => {
  it('bắt thiếu thợ, thiếu ngày, giờ sai dạng và giờ bằng nhau', () => {
    expect(validateRosterShift(shift({ technician_id: '' }), [])).toBe('roster.errTechnician')
    expect(validateRosterShift(shift({ weekdays: [] }), [])).toBe('roster.errDays')
    expect(validateRosterShift(shift({ start: '' }), [])).toBe('roster.errTime')
    expect(validateRosterShift(shift({ end: '06:00' }), [])).toBe('roster.errSameTime')
  })

  it('chỉ chặn chồng giờ với ca cùng vai', () => {
    const day = shift({})
    expect(validateRosterShift(shift({ technician_id: 'b', start: '17:00', end: '20:00' }), [day])).toBe('roster.errOverlap')
    expect(validateRosterShift(shift({ technician_id: 'b', role: 'BACKUP', start: '17:00', end: '20:00' }), [day])).toBeNull()
    expect(validateRosterShift(shift({ technician_id: 'b', start: '18:00', end: '22:00' }), [day])).toBeNull()
  })

  it('ca qua đêm thứ Bảy chồng ca sáng Chủ nhật', () => {
    const saturdayNight = shift({ weekdays: [6], start: '22:00', end: '06:00' })
    expect(isOvernightShift(saturdayNight)).toBe(true)
    expect(validateRosterShift(shift({ weekdays: [0], start: '05:00', end: '08:00' }), [saturdayNight])).toBe('roster.errOverlap')
    expect(validateRosterShift(shift({ weekdays: [0], start: '06:00', end: '08:00' }), [saturdayNight])).toBeNull()
  })
})
