import { formatVnDateTime, HOUSE_STAGE_LABEL, PARAMETER_LABEL, ROLE_LABEL, SEVERITY_LABEL } from '@/utils/displayLabel.util'
import { DEFAULT_BIRD_COUNT_TUNING, DEFAULT_DETECTION_TUNING, DEFAULT_HEALTH_LEVELS } from '@/utils/detectionTuning.util'
import { DEFAULT_FUZZY_TUNING } from '@/utils/fuzzyTuning.util'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'

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

  it('mọi tham số có thể đổi đều có tên tiếng Việt cho thông báo', () => {
    const keys = [DEFAULT_THRESHOLDS, DEFAULT_FUZZY_TUNING, DEFAULT_DETECTION_TUNING, DEFAULT_BIRD_COUNT_TUNING, DEFAULT_HEALTH_LEVELS]
      .flatMap(defaults => Object.keys(defaults))
    expect(keys.filter(key => !Object.hasOwn(PARAMETER_LABEL, key))).toEqual([])
    expect(Object.values(PARAMETER_LABEL).every(label => !/_/.test(label))).toBe(true)
  })

  it('giai đoạn nhà như thẻ giai đoạn trên web', () => {
    expect(HOUSE_STAGE_LABEL).toEqual({ ATTRACTING: 'Đang dẫn dụ', OCCUPIED: 'Đã có chim ở' })
  })
})
