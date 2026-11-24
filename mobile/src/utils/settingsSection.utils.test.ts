import { describe, expect, it } from '@jest/globals'
import {
  getSettingsSectionId,
  getExpertReviewNote,
  joinFooterNotes,
  withExpertReviewMessage,
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

describe('getExpertReviewNote', () => {
  it('chỉ chủ trại trên farm có chuyên gia thấy dòng "chuyên gia sẽ xem lại"', () => {
    expect(getExpertReviewNote('FARM_OWNER', true)).toBe('Thay đổi có hiệu lực ngay, chuyên gia sẽ xem lại')
    expect(getExpertReviewNote('FARM_OWNER', false)).toBeNull()
    expect(getExpertReviewNote('DOMAIN_EXPERT', true)).toBeNull()
  })

  it('chưa biết farm có chuyên gia hay không thì không ghi gì', () => {
    expect(getExpertReviewNote('FARM_OWNER', undefined)).toBeNull()
    expect(getExpertReviewNote(undefined, true)).toBeNull()
  })
})

describe('withExpertReviewMessage', () => {
  it('có dòng duyệt thì câu báo kèm lời nhắc, không có thì giữ nguyên', () => {
    expect(withExpertReviewMessage('Đã lưu', 'x')).toBe('Đã lưu. Chuyên gia sẽ xem lại thay đổi này.')
    expect(withExpertReviewMessage('Đã lưu', null)).toBe('Đã lưu')
  })
})

describe('joinFooterNotes', () => {
  it('ghép các dòng có chữ, bỏ dòng trống; không còn dòng nào thì undefined', () => {
    expect(joinFooterNotes('Một', null, 'Hai')).toBe('Một\nHai')
    expect(joinFooterNotes(null, undefined)).toBeUndefined()
  })
})
