import { describe, expect, it } from 'vitest'
import { housesInScope } from '@/components/features/technician/devices/deviceScope.utils'

const HOUSES = [
  { _id: 'h1', farm_id: 'f1' },
  { _id: 'h2', farm_id: 'f1' },
  { _id: 'h3', farm_id: 'f2' },
]

describe('housesInScope', () => {
  it('chọn nhà thì chỉ nhà đó', () => {
    expect(housesInScope(HOUSES, 'f1', 'h2')).toEqual([HOUSES[1]])
  })

  it('chọn trang trại thì các nhà của trang trại', () => {
    expect(housesInScope(HOUSES, 'f1', '')).toEqual([HOUSES[0], HOUSES[1]])
  })

  it('chưa chọn gì thì tất cả nhà được giao', () => {
    expect(housesInScope(HOUSES, '', '')).toEqual(HOUSES)
  })

  it('nhà đã chọn không còn trong danh sách thì không có nhà nào', () => {
    expect(housesInScope(HOUSES, 'f1', 'h9')).toEqual([])
  })
})
