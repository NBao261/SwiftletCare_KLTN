import { describe, expect, it } from '@jest/globals'
import type { Farm, FarmMember, House } from '@/types'
import { farmHasExpert, getHouseTechnicianNames } from '@/utils/farm.utils'

// Farm tối thiểu với danh sách thành viên cho test
function buildFarm(members: FarmMember[]): Farm {
  return { _id: 'farm-1', name: 'Farm', address: '', owner_id: 'owner', members, created_at: '2026-10-30T00:00:00.000Z' }
}

describe('farmHasExpert', () => {
  it('có thành viên DOMAIN_EXPERT thì có chuyên gia', () => {
    const owner: FarmMember = { user_id: 'owner', is_primary: true, role: 'FARM_OWNER', joined_at: '' }
    const expert: FarmMember = { user_id: 'expert', is_primary: false, role: 'DOMAIN_EXPERT', joined_at: '' }
    expect(farmHasExpert(buildFarm([owner, expert]))).toBe(true)
    expect(farmHasExpert(buildFarm([owner]))).toBe(false)
  })

  it('có has_active_expert của GET /farms thì theo cờ đó, kể cả khi chuyên gia duy nhất đã bị khoá', () => {
    const owner: FarmMember = { user_id: 'owner', is_primary: true, role: 'FARM_OWNER', joined_at: '' }
    const lockedExpert: FarmMember = { user_id: 'expert', is_primary: false, role: 'DOMAIN_EXPERT', joined_at: '' }
    expect(farmHasExpert({ ...buildFarm([owner, lockedExpert]), has_active_expert: false })).toBe(false)
    expect(farmHasExpert({ ...buildFarm([owner]), has_active_expert: true })).toBe(true)
  })
})

describe('getHouseTechnicianNames', () => {
  const house: House = {
    _id: 'house-1',
    farm_id: 'farm-1',
    name: 'Nhà A',
    floors: 2,
    technicians: [
      { user_id: 'backup', primary: false },
      { user_id: 'gone', primary: false },
      { user_id: 'main', primary: true },
    ],
  }
  const members: FarmMember[] = [
    { user_id: 'main', is_primary: false, role: 'FARM_TECHNICIAN', joined_at: '', full_name: 'Thợ chính' },
    { user_id: 'backup', is_primary: false, role: 'FARM_TECHNICIAN', joined_at: '', full_name: 'Thợ phụ' },
  ]

  it('người chính đứng đầu, người đã rời farm thì bỏ', () => {
    expect(getHouseTechnicianNames(house, members)).toEqual([
      { userId: 'main', name: 'Thợ chính', isPrimary: true },
      { userId: 'backup', name: 'Thợ phụ', isPrimary: false },
    ])
  })

  it('nhà chưa giao kỹ thuật viên thì danh sách rỗng', () => {
    expect(getHouseTechnicianNames({ ...house, technicians: undefined }, members)).toEqual([])
  })
})
