import { describe, expect, it } from '@jest/globals'
import type { BirdCountDay } from '@/types'
import { pickReturnRateHouse, sortHousesByReturnRate, type HouseReturnRate } from '@/utils/returnRate.utils'

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

function row(id: string, name: string, day: BirdCountDay | null): HouseReturnRate {
  return { house: { _id: id, name, farm_id: 'farm-1' }, day }
}

const ROWS = [
  row('a', 'Nhà A', buildDay(100, 90)),
  row('b', 'Nhà B', missingEvening),
  row('c', 'Nhà C', buildDay(100, 70)),
  row('d', 'Nhà D', null),
  row('e', 'Nhà E', buildDay(100, 95)),
]

const idsOf = (rows: HouseReturnRate[]) => rows.map(item => item.house._id)

describe('sortHousesByReturnRate', () => {
  it('thấp nhất trước hoặc cao nhất trước; nhà chưa có tỷ lệ luôn đứng cuối, theo tên', () => {
    expect(idsOf(sortHousesByReturnRate(ROWS, 'lowest-first'))).toEqual(['c', 'a', 'e', 'b', 'd'])
    expect(idsOf(sortHousesByReturnRate(ROWS, 'highest-first'))).toEqual(['e', 'a', 'c', 'b', 'd'])
  })

  it('bằng tỷ lệ thì xếp theo tên; không sửa mảng vào', () => {
    const rows = [row('y', 'Nhà Y', buildDay(10, 9)), row('x', 'Nhà X', buildDay(100, 90))]
    expect(idsOf(sortHousesByReturnRate(rows, 'highest-first'))).toEqual(['x', 'y'])
    expect(idsOf(rows)).toEqual(['y', 'x'])
  })
})

describe('pickReturnRateHouse', () => {
  const sorted = sortHousesByReturnRate(ROWS, 'lowest-first')

  it('nhà đã chọn còn trong danh sách thì giữ, không thì nhà đứng đầu', () => {
    expect(pickReturnRateHouse(sorted, 'e')?.house._id).toBe('e')
    expect(pickReturnRateHouse(sorted, null)?.house._id).toBe('c')
    expect(pickReturnRateHouse(sorted, 'removed')?.house._id).toBe('c')
  })

  it('không có nhà nào thì null', () => {
    expect(pickReturnRateHouse([], 'a')).toBeNull()
  })
})
