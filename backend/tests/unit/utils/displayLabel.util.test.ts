import { formatVnDateTime, ROLE_LABEL, SEVERITY_LABEL } from '@/utils/displayLabel.util'

describe('displayLabel.util', () => {
  it('tên role tiếng Việt như web, không lộ mã enum', () => {
    expect(ROLE_LABEL.FARM_OWNER).toBe('Chủ nhà yến')
    expect(ROLE_LABEL.FARM_TECHNICIAN).toBe('Kỹ thuật viên')
    expect(ROLE_LABEL.DOMAIN_EXPERT).toBe('Chuyên gia')
    expect(ROLE_LABEL.ADMIN).toBe('Quản trị viên')
  })

  it('mức cảnh báo 3 cấp: MEDIUM và LOW cùng là "Thường"', () => {
    expect(SEVERITY_LABEL.CRITICAL).toBe('Khẩn cấp')
    expect(SEVERITY_LABEL.HIGH).toBe('Cao')
    expect(SEVERITY_LABEL.MEDIUM).toBe('Thường')
    expect(SEVERITY_LABEL.LOW).toBe('Thường')
  })

  it('giờ Việt Nam (UTC+7), không phải giờ ISO', () => {
    const text = formatVnDateTime(new Date('2026-11-19T22:05:00Z'))
    expect(text).toContain('05:05')
    expect(text).toContain('20/11/2026')
    expect(text).not.toContain('T')
  })
})
