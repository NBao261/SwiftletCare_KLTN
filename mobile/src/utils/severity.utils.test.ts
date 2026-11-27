import { describe, expect, it } from '@jest/globals'
import {
  getLevelSeverity,
  getSeverityLevel,
  getSeverityLevelLabel,
  parseSeverityLevel,
  SEVERITY_LEVELS,
} from '@/utils/severity.utils'

describe('getSeverityLevel', () => {
  it('mỗi mức backend một cấp như web (G-32 Q-07)', () => {
    expect(getSeverityLevel('CRITICAL')).toBe('P1')
    expect(getSeverityLevel('HIGH')).toBe('P2')
    expect(getSeverityLevel('MEDIUM')).toBe('P3')
    expect(getSeverityLevel('LOW')).toBe('P4')
  })

  it('getLevelSeverity là chiều ngược lại', () => {
    for (const level of SEVERITY_LEVELS) expect(getSeverityLevel(getLevelSeverity(level))).toBe(level)
  })
})

describe('getSeverityLevelLabel', () => {
  it('nhãn khớp web', () => {
    expect(SEVERITY_LEVELS.map(getSeverityLevelLabel)).toEqual(['Khẩn cấp', 'Cao', 'Trung bình', 'Thấp'])
  })
})

describe('parseSeverityLevel', () => {
  it('nhận cấp và đổi mức của backend sang cấp', () => {
    expect(parseSeverityLevel('P4')).toBe('P4')
    expect(parseSeverityLevel('HIGH')).toBe('P2')
    expect(parseSeverityLevel('LOW')).toBe('P4')
  })

  it('giá trị lạ hoặc rỗng là null', () => {
    expect(parseSeverityLevel('abc')).toBeNull()
    expect(parseSeverityLevel('')).toBeNull()
    expect(parseSeverityLevel(null)).toBeNull()
  })
})
