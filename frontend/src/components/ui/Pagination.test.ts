import { describe, expect, it } from 'vitest'
import { pageItems } from '@/components/ui/Pagination'

describe('pageItems', () => {
  it('rút gọn bằng "…" quanh cửa sổ 3 trang (kể cả ở trang đầu/cuối)', () => {
    expect(pageItems(1, 30)).toEqual([1, 2, 3, '…', 30])
    expect(pageItems(5, 30)).toEqual([1, '…', 4, 5, 6, '…', 30])
    expect(pageItems(30, 30)).toEqual([1, '…', 28, 29, 30])
  })

  it('khoảng trống chỉ 1 trang thì hiện số thay vì "…"', () => {
    expect(pageItems(4, 30)).toEqual([1, 2, 3, 4, 5, '…', 30])
    expect(pageItems(2, 3)).toEqual([1, 2, 3])
  })
})
