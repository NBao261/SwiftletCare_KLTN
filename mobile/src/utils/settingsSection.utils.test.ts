import { describe, expect, it } from '@jest/globals'
import {
  getSettingsSectionId,
  getViewOnlyNote,
  isHouseSectionKind,
  parseSettingsSectionKind,
} from '@/utils/settingsSection.utils'

describe('getSettingsSectionId', () => {
  it('mục theo tầng kèm id zone, mức giảm tỷ lệ về tổ thuộc cả nhà', () => {
    expect(getSettingsSectionId('thresholds', 'zone-1')).toBe('thresholds:zone-1')
    expect(getSettingsSectionId('detection', 'zone-2')).toBe('detection:zone-2')
    expect(getSettingsSectionId('bird-count', 'zone-1')).toBe('bird-count-tuning')
  })

  it('giai đoạn nhà thuộc cả nhà nên không kèm id zone', () => {
    expect(getSettingsSectionId('stage', 'zone-1')).toBe('house-stage')
  })
})

describe('isHouseSectionKind', () => {
  it('mức giảm tỷ lệ về tổ và giai đoạn thuộc cả nhà, ngưỡng thuộc từng tầng', () => {
    expect(isHouseSectionKind('bird-count')).toBe(true)
    expect(isHouseSectionKind('stage')).toBe(true)
    expect(isHouseSectionKind('thresholds')).toBe(false)
  })
})

describe('parseSettingsSectionKind', () => {
  it('nhận đúng tên mục, giá trị lạ hoặc thiếu thì null', () => {
    expect(parseSettingsSectionKind('fuzzy')).toBe('fuzzy')
    expect(parseSettingsSectionKind('stage')).toBe('stage')
    expect(parseSettingsSectionKind('relay')).toBeNull()
    expect(parseSettingsSectionKind(undefined)).toBeNull()
  })
})

describe('getViewOnlyNote', () => {
  it('chủ trại ở farm có chuyên gia thì nói rõ việc của chuyên gia; còn lại chỉ xem', () => {
    expect(getViewOnlyNote(true, true)).toBe('Farm đã có chuyên gia: chuyên gia đặt mục này, bạn chỉ xem')
    expect(getViewOnlyNote(false, false)).toBe('Bạn chỉ xem mục này')
  })

  it('chủ trại khi chưa biết farm có chuyên gia hay không thì không ghi gì', () => {
    expect(getViewOnlyNote(true, undefined)).toBeNull()
  })
})
