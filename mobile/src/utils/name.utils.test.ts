import { describe, expect, it } from '@jest/globals'
import { getInitials, truncateText } from '@/utils/name.utils'

describe('getInitials', () => {
  it('lấy chữ đầu của từ đầu và từ cuối', () => {
    expect(getInitials('Nguyễn Vũ Len')).toBe('NL')
  })

  it('tên một từ thì một chữ', () => {
    expect(getInitials('Len')).toBe('L')
  })

  it('tên rỗng thì hiện _', () => {
    expect(getInitials('   ')).toBe('_')
  })
})

describe('truncateText', () => {
  it('dài hơn giới hạn thì cắt và thêm dấu …', () => {
    expect(truncateText('Nhà yến Bình Thuận', 10)).toBe('Nhà yến Bì…')
  })

  it('không quá giới hạn thì giữ nguyên', () => {
    expect(truncateText('Nhà chính', 10)).toBe('Nhà chính')
  })
})
