import { formatChanges } from '@/services/expertActivity.service'

describe('expertActivity.service#formatChanges', () => {
  it('chỉ ghi khoá đổi giá trị, bằng tên tham số tiếng Việt', () => {
    expect(formatChanges({ humidity_min: 75, humidity_max: 95 }, { humidity_min: 78, humidity_max: 95 }))
      .toBe('Độ ẩm tối thiểu (%): 75 → 78')
  })

  it('bật/tắt, số thập phân kiểu Việt Nam, giá trị chưa có và nhiều thay đổi', () => {
    expect(formatChanges(
      { fuzzy_input_filter: false, light_max: 0.2 },
      { fuzzy_input_filter: true, light_max: 0.35, noise_margin_db: 18 },
    )).toBe('Lọc nhiễu cảm biến đầu vào: tắt → bật; Ánh sáng tối đa (lux): 0,2 → 0,35; Biên độ ồn vượt nền (dB): chưa đặt → 18')
  })

  it('không có thay đổi thì chuỗi rỗng (chi tiết thông báo bị bỏ)', () => {
    expect(formatChanges({ temp_min: 26 }, { temp_min: 26 })).toBe('')
  })
})
