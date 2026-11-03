import { describe, expect, it } from '@jest/globals'
import { isValidEmail, isValidPassword, isValidClockTime } from '@/utils/validation.utils'

describe('isValidEmail', () => {
  it('nhận email đúng dạng, bỏ khoảng trắng hai đầu', () => {
    expect(isValidEmail('owner@swiftletcare.dev')).toBe(true)
    expect(isValidEmail('  owner@swiftletcare.dev ')).toBe(true)
  })

  it('từ chối thiếu @ hoặc thiếu tên miền', () => {
    expect(isValidEmail('owner.swiftletcare.dev')).toBe(false)
    expect(isValidEmail('owner@')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('isValidPassword', () => {
  it('đúng luật backend: tối thiểu 8 ký tự', () => {
    expect(isValidPassword('1234567')).toBe(false)
    expect(isValidPassword('12345678')).toBe(true)
  })
})

describe('isValidClockTime', () => {
  it('nhận HH:MM 24 giờ, từ chối giờ sai dạng', () => {
    expect(isValidClockTime('22:00')).toBe(true)
    expect(isValidClockTime('06:30')).toBe(true)
    expect(isValidClockTime('24:00')).toBe(false)
    expect(isValidClockTime('6:00')).toBe(false)
  })
})
