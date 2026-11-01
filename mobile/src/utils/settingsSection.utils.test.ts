import { describe, expect, it } from '@jest/globals'
import { getSettingsSectionId, parseSettingsSectionKind } from '@/utils/settingsSection.utils'

describe('getSettingsSectionId', () => {
  it('mục theo tầng kèm id zone, mức giảm tỷ lệ về tổ thuộc cả nhà', () => {
    expect(getSettingsSectionId('thresholds', 'zone-1')).toBe('thresholds:zone-1')
    expect(getSettingsSectionId('detection', 'zone-2')).toBe('detection:zone-2')
    expect(getSettingsSectionId('bird-count', 'zone-1')).toBe('bird-count-tuning')
  })
})

describe('parseSettingsSectionKind', () => {
  it('nhận đúng tên mục, giá trị lạ hoặc thiếu thì null', () => {
    expect(parseSettingsSectionKind('fuzzy')).toBe('fuzzy')
    expect(parseSettingsSectionKind('relay')).toBeNull()
    expect(parseSettingsSectionKind(undefined)).toBeNull()
  })
})
