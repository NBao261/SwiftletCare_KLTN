import { describe, expect, it } from '@jest/globals'
import type { BirdCountDay } from '@/types'
import { summarizeReturnRate } from '@/utils/returnRate.utils'

// Ngày đếm có đủ hai phiên; return_rate tính như backend
function buildDay(netExit: number, netEntry: number): BirdCountDay {
  return {
    date: '2026-10-30',
    morning_entry: 0,
    morning_exit: netExit,
    evening_entry: netEntry,
    evening_exit: 0,
    net_exit: netExit,
    net_entry: netEntry,
    return_rate: netExit > 0 ? (netEntry / netExit) * 100 : null,
    has_morning: true,
    has_evening: true,
  }
}

const missingEvening: BirdCountDay = { ...buildDay(100, 0), return_rate: null, has_evening: false }

describe('summarizeReturnRate', () => {
  it('cộng số ròng của các nhà rồi mới chia', () => {
    const summary = summarizeReturnRate([
      { houseName: 'Nhà A', day: buildDay(100, 100) },
      { houseName: 'Nhà B', day: buildDay(300, 240) },
    ])
    expect(summary.rate).toBeCloseTo(85)
    expect(summary.housesWithData).toBe(2)
    expect(summary.lowest).toEqual({ houseName: 'Nhà B', rate: 80 })
  })

  it('bỏ nhà chưa đủ hai phiên', () => {
    const summary = summarizeReturnRate([
      { houseName: 'Nhà A', day: buildDay(200, 190) },
      { houseName: 'Nhà B', day: missingEvening },
    ])
    expect(summary.rate).toBeCloseTo(95)
    expect(summary.housesWithData).toBe(1)
    expect(summary.lowest).toBeNull()
  })

  it('chưa nhà nào đủ dữ liệu thì tỷ lệ null', () => {
    expect(summarizeReturnRate([{ houseName: 'Nhà A', day: missingEvening }])).toEqual({
      rate: null,
      housesWithData: 0,
      lowest: null,
    })
  })
})
