import { describe, expect, it } from '@jest/globals'
import type { CountingDayWindows } from '@/types'
import {
  countDays,
  dayOfYear,
  formatDateRange,
  formatDayWindows,
  formatDayWindowsInline,
  formatMonthDay,
  formatMonthDayRange,
  formatTimeWindow,
  isValidDate,
  isValidTime,
  validateCountingSchedule,
  validateDayWindows,
  validateProfile,
  validateTemporaryWindow,
} from '@/utils/countingSchedule.utils'

const WINDOWS: CountingDayWindows = {
  morning: { start: '05:30', end: '07:00' },
  evening: { start: '17:30', end: '19:00' },
}

describe('isValidTime / isValidDate / dayOfYear', () => {
  it('giờ 24 giờ dạng HH:mm', () => {
    expect(isValidTime('05:30')).toBe(true)
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('5:30')).toBe(false)
  })

  it('ngày YYYY-MM-DD phải có thật', () => {
    expect(isValidDate('2026-11-19')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
  })

  it('MM-DD theo năm nhuận, sai dạng thì null', () => {
    expect(dayOfYear('01-01')).toBe(0)
    expect(dayOfYear('03-01')).toBe(60)
    expect(dayOfYear('02-29')).toBe(59)
    expect(dayOfYear('13-01')).toBeNull()
  })
})

describe('validateDayWindows', () => {
  it('khung đúng thì không lỗi', () => {
    expect(validateDayWindows(WINDOWS)).toBeNull()
  })

  it('giờ bắt đầu sau giờ kết thúc hoặc khung sáng chạm khung chiều thì lỗi', () => {
    expect(validateDayWindows({ ...WINDOWS, morning: { start: '07:00', end: '05:30' } })).not.toBeNull()
    expect(validateDayWindows({ ...WINDOWS, morning: { start: '05:30', end: '17:30' } })).not.toBeNull()
  })
})

describe('validateProfile / validateTemporaryWindow', () => {
  it('hồ sơ cần tên và ngày MM-DD', () => {
    expect(validateProfile({ name: 'Mùa khô', from: '01-01', to: '04-30', ...WINDOWS })).toBeNull()
    expect(validateProfile({ name: ' ', from: '01-01', to: '04-30', ...WINDOWS })).not.toBeNull()
    expect(validateProfile({ name: 'Mùa khô', from: '1-1', to: '04-30', ...WINDOWS })).not.toBeNull()
  })

  it('khung tạm: ngày bắt đầu không được sau ngày kết thúc', () => {
    expect(validateTemporaryWindow({ from: '2026-11-20', to: '2026-11-22', ...WINDOWS })).toBeNull()
    expect(validateTemporaryWindow({ from: '2026-11-22', to: '2026-11-20', ...WINDOWS })).not.toBeNull()
  })
})

describe('validateCountingSchedule', () => {
  it('hồ sơ chồng ngày nhau thì lỗi, kể cả hồ sơ vắt qua năm mới', () => {
    const dry = { name: 'Khô', from: '12-01', to: '02-28', ...WINDOWS }
    const rainy = { name: 'Mưa', from: '02-15', to: '06-30', ...WINDOWS }
    expect(validateCountingSchedule({ profiles: [dry, rainy], temporary: [] })).not.toBeNull()
    expect(validateCountingSchedule({ profiles: [dry, { ...rainy, from: '03-01' }], temporary: [] })).toBeNull()
  })

  it('khung tạm chồng ngày thì lỗi', () => {
    const first = { from: '2026-11-20', to: '2026-11-22', ...WINDOWS }
    const second = { from: '2026-11-22', to: '2026-11-25', ...WINDOWS }
    expect(validateCountingSchedule({ profiles: [], temporary: [second, first] })).not.toBeNull()
    expect(validateCountingSchedule({ profiles: [], temporary: [first, { ...second, from: '2026-11-23' }] })).toBeNull()
  })
})

describe('định dạng khung và ngày', () => {
  // Bỏ dấu nối không ngắt dòng để so chữ dễ đọc
  const plain = (text: string) => text.replace(/\u2060/g, '')

  it('sáng và chiều mỗi khung một dòng, không ngắt dòng ở dấu "–"', () => {
    expect(plain(formatDayWindows(WINDOWS))).toBe('Sáng 05:30–07:00\nChiều 17:30–19:00')
    expect(formatTimeWindow(WINDOWS.morning)).toBe('05:30\u2060–\u206007:00')
  })

  it('ngày dd/MM của hồ sơ; khoảng ngày của khung tạm gọn trên một dòng', () => {
    expect(formatMonthDay('03-15')).toBe('15/03')
    expect(plain(formatMonthDayRange('12-01', '02-28'))).toBe('01/12–28/02')
    expect(formatDateRange('2026-11-17', '2026-11-17')).toBe('17/11/2026')
    expect(plain(formatDateRange('2026-11-17', '2026-11-19'))).toBe('17/11–19/11/2026')
    expect(plain(formatDateRange('2026-12-28', '2027-01-02'))).toBe('28/12/2026–02/01/2027')
  })

  it('số ngày của khung tạm tính cả hai đầu', () => {
    expect(countDays('2026-11-17', '2026-11-17')).toBe(1)
    expect(countDays('2026-12-30', '2027-01-02')).toBe(4)
  })

  it('hai khung trên một dòng ngăn bằng dấu "·"', () => {
    expect(plain(formatDayWindowsInline(WINDOWS))).toBe('Sáng 05:30–07:00 · Chiều 17:30–19:00')
  })
})
