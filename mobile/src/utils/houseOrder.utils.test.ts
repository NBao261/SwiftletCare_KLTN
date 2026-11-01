import { describe, expect, it } from '@jest/globals'
import type { House } from '@/types'
import { resolveEntryHouseId, sortPinnedFirst } from '@/utils/houseOrder.utils'

// Nhà tối thiểu cho test
function buildHouse(id: string): House {
  return { _id: id, farm_id: 'farm-1', name: `Nhà ${id}`, floors: 1 }
}

const houses = [buildHouse('a'), buildHouse('b'), buildHouse('c')]

describe('sortPinnedFirst', () => {
  it('nhà ghim lên đầu, còn lại giữ thứ tự cũ', () => {
    expect(sortPinnedFirst(houses, ['c']).map(house => house._id)).toEqual(['c', 'a', 'b'])
  })

  it('chưa ghim hoặc id ghim không còn thì giữ nguyên', () => {
    expect(sortPinnedFirst(houses, []).map(house => house._id)).toEqual(['a', 'b', 'c'])
    expect(sortPinnedFirst(houses, ['x']).map(house => house._id)).toEqual(['a', 'b', 'c'])
  })
})

describe('resolveEntryHouseId', () => {
  it('farm 1 nhà thì luôn vào nhà đó', () => {
    expect(resolveEntryHouseId([buildHouse('a')], undefined)).toBe('a')
  })

  it('nhà xem gần nhất còn thì vào nhà đó, không còn thì ở lại danh sách', () => {
    expect(resolveEntryHouseId(houses, 'b')).toBe('b')
    expect(resolveEntryHouseId(houses, 'x')).toBeNull()
    expect(resolveEntryHouseId(houses, undefined)).toBeNull()
  })
})
