import { describe, expect, it } from 'vitest'
import { historyRows, type HistoryEntry } from '@/components/features/domain-expert/counting-schedule/scheduleHistory.utils'

const entry = (effective_from: string, changed_at: string): HistoryEntry => ({
  effective_from, changed_at, changed_by: 'u1', changed_by_role: 'DOMAIN_EXPERT', schedule: { profiles: [], temporary: [] },
})

describe('historyRows', () => {
  it('mới nhất trước; lần sửa cuối là LATEST', () => {
    const rows = historyRows([entry('2026-11-10', '2026-11-09T08:00:00Z'), entry('2026-11-18', '2026-11-17T08:00:00Z')])
    expect(rows.map(row => [row.entry.effective_from, row.state])).toEqual([['2026-11-18', 'LATEST'], ['2026-11-10', 'APPLIED']])
  })

  it('lần sửa bị lần sau cùng ngày áp thay là SUPERSEDED', () => {
    const rows = historyRows([
      entry('2026-11-18', '2026-11-17T08:00:00Z'), entry('2026-11-18', '2026-11-17T09:00:00Z'), entry('2026-11-19', '2026-11-18T08:00:00Z'),
    ])
    expect(rows.map(row => row.state)).toEqual(['LATEST', 'APPLIED', 'SUPERSEDED'])
  })

  it('lịch sử rỗng', () => {
    expect(historyRows([])).toEqual([])
  })
})
