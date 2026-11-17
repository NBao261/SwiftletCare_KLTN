import {
  DEFAULT_WINDOWS, parseCountingSchedule, returnRateCheckAt, scheduleOn, windowsOn, type CountingSchedule,
} from '@/utils/countingSchedule.util'

const RAINY = { morning: { start: '06:00', end: '07:30' }, evening: { start: '17:00', end: '18:30' } }
const DRY = { morning: { start: '05:15', end: '06:45' }, evening: { start: '17:45', end: '19:15' } }

describe('parseCountingSchedule (VISION-FR-019)', () => {
  it('accepts seasonal profiles, one crossing the new year, and temporary windows', () => {
    const schedule = parseCountingSchedule({
      profiles: [{ name: 'Mùa khô', from: '01-15', to: '04-30', ...DRY }, { name: 'Mùa mưa', from: '09-01', to: '01-14', ...RAINY }],
      temporary: [{ from: '2026-11-20', to: '2026-11-22', ...RAINY }],
    })
    expect(schedule.profiles).toHaveLength(2)
    expect(schedule.temporary[0].from).toBe('2026-11-20')
    expect(parseCountingSchedule({})).toEqual({ profiles: [], temporary: [] })
    // Một hồ sơ cả năm
    expect(parseCountingSchedule({ profiles: [{ name: 'Cả năm', from: '01-01', to: '12-31', ...DRY }] }).profiles).toHaveLength(1)
  })

  it.each([
    ['overlapping profiles', { profiles: [{ name: 'A', from: '01-01', to: '03-31', ...DRY }, { name: 'B', from: '03-31', to: '05-01', ...DRY }] }],
    ['profiles overlapping across the new year', { profiles: [{ name: 'A', from: '12-01', to: '01-31', ...DRY }, { name: 'B', from: '01-15', to: '02-15', ...DRY }] }],
    ['a window whose start is not before its end', { profiles: [{ name: 'A', from: '01-01', to: '01-31', ...DRY, morning: { start: '07:00', end: '07:00' } }] }],
    ['a morning window that does not end before the evening starts', {
      temporary: [{ from: '2026-11-20', to: '2026-11-20', morning: { start: '05:00', end: '18:00' }, evening: { start: '17:30', end: '19:00' } }],
    }],
    ['a time not in HH:mm', { profiles: [{ name: 'A', from: '01-01', to: '01-31', ...DRY, evening: { start: '5:30 PM', end: '19:00' } }] }],
    ['a date that does not exist', { profiles: [{ name: 'A', from: '02-30', to: '03-01', ...DRY }] }],
    ['overlapping temporary windows', { temporary: [{ from: '2026-11-20', to: '2026-11-22', ...RAINY }, { from: '2026-11-22', to: '2026-11-23', ...RAINY }] }],
    ['a temporary window ending before it starts', { temporary: [{ from: '2026-11-22', to: '2026-11-20', ...RAINY }] }],
    ['a profile without a name', { profiles: [{ name: ' ', from: '01-01', to: '01-31', ...DRY }] }],
  ])('rejects %s with 400', (_label, input) => {
    expect(() => parseCountingSchedule(input)).toThrow(expect.objectContaining({ statusCode: 400 }))
  })
})

describe('windowsOn, scheduleOn (VISION-FR-019, BR-13)', () => {
  const schedule: CountingSchedule = {
    profiles: [{ name: 'Mùa mưa', from: '09-01', to: '01-14', ...RAINY }],
    temporary: [{ from: '2026-11-20', to: '2026-11-21', ...DRY }],
  }

  it('a temporary window wins over the profile; a day of no profile uses the default windows', () => {
    expect(windowsOn(schedule, '2026-11-20')).toEqual({ ...DRY, source: 'TEMPORARY' })
    expect(windowsOn(schedule, '2026-11-22')).toEqual({ ...RAINY, source: 'PROFILE' })
    expect(windowsOn(schedule, '2027-01-10')).toEqual({ ...RAINY, source: 'PROFILE' })
    expect(windowsOn(schedule, '2026-06-01')).toEqual({ ...DEFAULT_WINDOWS, source: 'DEFAULT' })
    expect(windowsOn(undefined, '2026-11-20').source).toBe('DEFAULT')
  })

  it('a change applies from its effective day; earlier days keep the earlier schedule', () => {
    const history = [
      { schedule: { profiles: [], temporary: [] }, effective_from: '2026-11-10' },
      { schedule, effective_from: '2026-11-18' },
    ]
    expect(scheduleOn(history, '2026-11-09')).toBeUndefined()
    expect(scheduleOn(history, '2026-11-17')).toEqual({ profiles: [], temporary: [] })
    expect(scheduleOn(history, '2026-11-18')).toBe(schedule)
  })

  it('BR-21: the check runs 15 min after the evening window, never past the end of the day', () => {
    expect(returnRateCheckAt('2026-11-17', DEFAULT_WINDOWS).toISOString()).toBe('2026-11-17T12:15:00.000Z') // 19:15 VN
    const late = { ...DEFAULT_WINDOWS, evening: { start: '22:00', end: '23:55' } }
    expect(returnRateCheckAt('2026-11-17', late).toISOString()).toBe('2026-11-17T16:59:00.000Z') // 23:59 VN
  })
})
