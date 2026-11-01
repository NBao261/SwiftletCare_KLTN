import { describe, expect, it } from '@jest/globals'
import type { Farm, FarmMember } from '@/types'
import { farmHasExpert } from '@/utils/farm.utils'

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
})
