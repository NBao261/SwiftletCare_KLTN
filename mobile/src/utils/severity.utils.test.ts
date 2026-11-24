import { describe, expect, it } from '@jest/globals'
import { getSeverityLevel, getSeverityLevelLabel, parseSeverityLevel } from '@/utils/severity.utils'

describe('getSeverityLevel', () => {
  it('gộp Nghiêm trọng và Cao vào P1 như web', () => {
    expect(getSeverityLevel('CRITICAL')).toBe('P1')
    expect(getSeverityLevel('HIGH')).toBe('P1')
  })

  it('Trung bình là P2, Thấp là P3', () => {
    expect(getSeverityLevel('MEDIUM')).toBe('P2')
    expect(getSeverityLevel('LOW')).toBe('P3')
  })
})

describe('getSeverityLevelLabel', () => {
  it('nhãn khớp web', () => {
    expect(getSeverityLevelLabel('P1')).toBe('Khẩn cấp')
    expect(getSeverityLevelLabel('P3')).toBe('Thường')
  })
})

describe('parseSeverityLevel', () => {
  it('nhận cấp và đổi mức cũ của backend sang cấp', () => {
    expect(parseSeverityLevel('P2')).toBe('P2')
    expect(parseSeverityLevel('HIGH')).toBe('P1')
    expect(parseSeverityLevel('LOW')).toBe('P3')
  })

  it('giá trị lạ hoặc rỗng là null', () => {
    expect(parseSeverityLevel('abc')).toBeNull()
    expect(parseSeverityLevel('')).toBeNull()
    expect(parseSeverityLevel(null)).toBeNull()
  })
})
