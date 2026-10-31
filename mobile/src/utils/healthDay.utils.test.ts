import { describe, expect, it } from '@jest/globals'
import type { PendingHealthDay } from '@/types'
import { getRatingDaysLeft, summarizePendingTasks } from '@/utils/healthDay.utils'

// 30/10/2026 08:00 giờ Việt Nam
const now = new Date('2026-10-30T01:00:00.000Z').getTime()

// Việc chấm ngày tối thiểu cho test
function buildDay(houseId: string, date: string): PendingHealthDay {
  return { _id: `${houseId}-${date}`, house_id: houseId, house_name: houseId, farm_id: 'farm-1', farm_name: 'Farm', date }
}

describe('getRatingDaysLeft', () => {
  it('hạn chót là 7 ngày sau ngày cần đánh giá', () => {
    expect(getRatingDaysLeft('2026-10-29', now)).toBe(6)
    expect(getRatingDaysLeft('2026-10-24', now)).toBe(1)
  })
})

describe('summarizePendingTasks', () => {
  it('tổng là số việc, không phải số loại việc', () => {
    const summary = summarizePendingTasks([buildDay('house-a', '2026-10-29'), buildDay('house-b', '2026-10-29')], 1, now)
    expect(summary.total).toBe(3)
    expect(summary.summary).toBe('2 nhà chờ đánh giá ngày · 1 cảnh báo chờ phán quyết')
    expect(summary.isDueSoon).toBe(false)
  })

  it('còn không quá 1 ngày thì bật chấm cam', () => {
    expect(summarizePendingTasks([buildDay('house-a', '2026-10-24')], 0, now).isDueSoon).toBe(true)
  })

  it('chỉ có cảnh báo chờ phán quyết thì không bật chấm cam', () => {
    expect(summarizePendingTasks([], 2, now)).toEqual({ total: 2, summary: '2 cảnh báo chờ phán quyết', isDueSoon: false })
  })
})
