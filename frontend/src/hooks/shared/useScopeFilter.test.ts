import { describe, expect, it } from 'vitest'
import { pickAutoScope, type AutoScopeInput } from '@/hooks/shared/useScopeFilter'
import { scopeDepthOf, scopeLevelOf } from '@/constants/roles'

const BASE: AutoScopeInput = {
  level: 'farm',
  farmIds: ['f1', 'f2'],
  lastFarmId: null,
  farmId: '',
  houseId: '',
  zoneId: '',
  houses: [{ _id: 'h1', farm_id: 'f1' }, { _id: 'h2', farm_id: 'f2' }],
  zones: [
    { _id: 'z1', house_id: 'h1', farmId: 'f1' },
    { _id: 'z2', house_id: 'h1', farmId: 'f1' },
    { _id: 'z3', house_id: 'h2', farmId: 'f2' },
  ],
  nodes: [],
}

// trang cần một bậc phạm vi thì tự chọn bậc có dữ liệu, không để trang trống "Chọn một trang trại"
describe('pickAutoScope', () => {
  it('trang không cần phạm vi giữ nguyên "Tất cả"', () => {
    expect(pickAutoScope({ ...BASE, level: 'none' })).toBeNull()
  })

  it('cần trang trại: lấy trang trại mở gần nhất, không có thì trang trại đầu', () => {
    expect(pickAutoScope({ ...BASE, lastFarmId: 'f2' })).toEqual({ farmId: 'f2', houseId: '', zoneId: '' })
    expect(pickAutoScope({ ...BASE, lastFarmId: 'đã xoá' })).toEqual({ farmId: 'f1', houseId: '', zoneId: '' })
  })

  it('đã chọn trang trại thì không đổi', () => {
    expect(pickAutoScope({ ...BASE, farmId: 'f2' })).toBeNull()
  })

  it('cần nhà: nhà đầu tiên của trang trại', () => {
    expect(pickAutoScope({ ...BASE, level: 'house', farmId: 'f2' })).toEqual({ farmId: 'f2', houseId: 'h2', zoneId: '' })
  })

  it('cần Zone: Zone có bộ điều khiển online trước, rồi Zone có thiết bị, không mở vào Zone rỗng', () => {
    const nodes = [{ zone_id: 'z1', status: 'OFFLINE' }, { zone_id: 'z2', status: 'ONLINE' }]
    expect(pickAutoScope({ ...BASE, level: 'zone', nodes })).toEqual({ farmId: 'f1', houseId: 'h1', zoneId: 'z2' })
    expect(pickAutoScope({ ...BASE, level: 'zone', nodes: [{ zone_id: 'z2', status: 'OFFLINE' }] })).toEqual({ farmId: 'f1', houseId: 'h1', zoneId: 'z2' })
  })

  it('không có trang trại nào thì không chọn', () => {
    expect(pickAutoScope({ ...BASE, farmIds: [] })).toBeNull()
  })
})

describe('scopeLevelOf', () => {
  it('trang con theo bậc của trang cha', () => {
    expect(scopeLevelOf('/overview')).toBe('farm')
    expect(scopeLevelOf('/domain-expert/tuning')).toBe('zone')
    expect(scopeLevelOf('/dashboard')).toBe('none')
  })
})

describe('scopeDepthOf', () => {
  it('ô sâu nhất trên thanh phạm vi: theo bậc, trừ trang khai thêm depth; trang không khai thì đủ ba ô', () => {
    expect(scopeDepthOf('/domain-expert/queue')).toBe('farm')
    expect(scopeDepthOf('/domain-expert/history')).toBe('house')
    expect(scopeDepthOf('/domain-expert/reports')).toBe('house')
    expect(scopeDepthOf('/domain-expert/counting-ring')).toBe('house')
    expect(scopeDepthOf('/domain-expert/tuning')).toBe('zone')
    expect(scopeDepthOf('/dashboard')).toBe('zone')
  })
})
