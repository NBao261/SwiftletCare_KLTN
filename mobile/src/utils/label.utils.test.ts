import { describe, expect, it } from '@jest/globals'
import type { ParameterReviewGroup } from '@/types'
import { getParameterReviewGroupLabel } from '@/utils/label.utils'

describe('getParameterReviewGroupLabel', () => {
  it('đủ 7 nhóm của backend (BR-22), không nhóm nào hiện mã thô', () => {
    const groups: ParameterReviewGroup[] = [
      'thresholds',
      'fuzzy',
      'detection',
      'return_rate_drop',
      'health_levels',
      'counting_schedule',
      'counting_ring',
    ]
    expect(groups.map(getParameterReviewGroupLabel)).toEqual([
      'Ngưỡng',
      'Hệ số điều khiển',
      'Tham số phát hiện',
      'Mức giảm tỷ lệ về tổ',
      'Mức chỉ số sức khỏe',
      'Lịch đếm chim',
      'Vòng đếm',
    ])
  })
})
