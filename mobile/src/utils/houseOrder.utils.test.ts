import { describe, expect, it } from '@jest/globals'
import type { Farm, House } from '@/types'
import { orderHousesByFarm, resolveEntryHouseId, sortPinnedFirst } from '@/utils/houseOrder.utils'

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

describe('orderHousesByFarm', () => {
  const farm = (id: string, name: string): Farm => ({ _id: id, name, address: '', owner_id: 'owner', members: [], created_at: '' })
  const house = (id: string, farmId: string): House => ({ _id: id, farm_id: farmId, name: `Nhà ${id}`, floors: 1 })

  it('theo thứ tự farm, trong farm nhà ghim lên đầu, kèm tên farm', () => {
    const choices = orderHousesByFarm(
      [farm('farm-1', 'Farm A'), farm('farm-2', 'Farm B')],
      [house('b1', 'farm-2'), house('a1', 'farm-1'), house('a2', 'farm-1')],
      ['a2'],
    )
    expect(choices.map(choice => [choice.house._id, choice.farmName, choice.isPinned])).toEqual([
      ['a2', 'Farm A', true],
      ['a1', 'Farm A', false],
      ['b1', 'Farm B', false],
    ])
  })

  it('nhà của farm không còn trong danh sách thì bỏ', () => {
    expect(orderHousesByFarm([farm('farm-1', 'Farm A')], [house('x1', 'farm-9')], [])).toEqual([])
  })
})
