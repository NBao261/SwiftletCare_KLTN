import { describe, expect, it } from '@jest/globals'
import {
  formatMonthDayInput,
  formatTimeInput,
  getMonthDayInputError,
  getTimeInputError,
  getTimeRangeError,
  isCompleteTime,
} from '@/utils/timeInput.utils'

describe('formatTimeInput', () => {
  it('tự chèn ":" sau 2 chữ số giờ, bỏ chữ không phải số, tối đa 4 chữ số', () => {
    expect(formatTimeInput('0530')).toBe('05:30')
    expect(formatTimeInput('123')).toBe('12:3')
    expect(formatTimeInput('12:345')).toBe('12:34')
    expect(formatTimeInput('ab1c7')).toBe('17')
  })

  it('chữ số giờ đầu lớn hơn 2 thì thêm 0 phía trước', () => {
    expect(formatTimeInput('5')).toBe('05')
    expect(formatTimeInput('930')).toBe('09:30')
  })

  it('xoá lùi qua dấu ":" vẫn xoá được tiếp', () => {
    expect(formatTimeInput('12:')).toBe('12')
    expect(formatTimeInput('1')).toBe('1')
  })
})

describe('getTimeInputError', () => {
  it('báo ngay khi giờ quá 23 hoặc phút quá 59', () => {
    expect(getTimeInputError('25')).toBe('Giờ từ 00 đến 23')
    expect(getTimeInputError('24:00')).toBe('Giờ từ 00 đến 23')
    expect(getTimeInputError('07:7')).toBe('Phút từ 00 đến 59')
  })

  it('đang gõ dở mà chưa sai thì chưa báo', () => {
    expect(getTimeInputError('')).toBeNull()
    expect(getTimeInputError('2')).toBeNull()
    expect(getTimeInputError('23:5')).toBeNull()
    expect(isCompleteTime('23:59')).toBe(true)
    expect(isCompleteTime('23:5')).toBe(false)
  })

  it('khung giờ: kết thúc phải sau bắt đầu, chỉ xét khi gõ xong cả hai', () => {
    expect(getTimeRangeError('07:00', '05:30')).toBe('Giờ kết thúc phải sau giờ bắt đầu')
    expect(getTimeRangeError('05:30', '07:00')).toBeNull()
    expect(getTimeRangeError('07:00', '05')).toBeNull()
  })
})

describe('ô ngày MM-DD', () => {
  it('tự chèn "-", chữ số tháng đầu lớn hơn 1 thì thêm 0', () => {
    expect(formatMonthDayInput('0315')).toBe('03-15')
    expect(formatMonthDayInput('9')).toBe('09')
  })

  it('tháng 01–12, ngày không quá số ngày của tháng', () => {
    expect(getMonthDayInputError('13')).toBe('Tháng từ 01 đến 12')
    expect(getMonthDayInputError('02-30')).toBe('Ngày từ 01 đến 29')
    expect(getMonthDayInputError('04-31')).toBe('Ngày từ 01 đến 30')
    expect(getMonthDayInputError('12-31')).toBeNull()
    expect(getMonthDayInputError('1')).toBeNull()
  })
})
