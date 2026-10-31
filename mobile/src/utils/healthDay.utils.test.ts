import { describe, expect, it } from '@jest/globals'
import type { PendingHealthDay } from '@/types'
import { summarizePendingTasks } from '@/utils/healthDay.utils'

// Việc chấm ngày tối thiểu cho test
function buildDay(houseId: string, date: string): PendingHealthDay {
  return { _id: `${houseId}-${date}`, house_id: houseId, house_name: houseId, farm_id: 'farm-1', farm_name: 'Farm', date }
}

describe('summarizePendingTasks', () => {
  it('tổng là số việc, không phải số loại việc', () => {
    const summary = summarizePendingTasks([buildDay('house-a', '2026-10-29'), buildDay('house-b', '2026-10-29')], 1)
    expect(summary.total).toBe(3)
    expect(summary.summary).toBe('2 nhà chờ đánh giá ngày · 1 cảnh báo chờ phán quyết')
  })

  it('chỉ có cảnh báo chờ phán quyết', () => {
    expect(summarizePendingTasks([], 2)).toEqual({ total: 2, summary: '2 cảnh báo chờ phán quyết' })
  })

  it('không có việc thì tổng 0 và câu rỗng', () => {
    expect(summarizePendingTasks([], 0)).toEqual({ total: 0, summary: '' })
  })
})
