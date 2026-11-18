import { describe, expect, it } from 'vitest'

import { expertDecisionRights } from '@/hooks/domain-expert/expertDecisionRights'

describe('expertDecisionRights (BR-22, todo-audit-1118 W-02)', () => {
  it('Domain Expert quyết định mọi việc của chuyên gia', () => {
    expect(expertDecisionRights('DOMAIN_EXPERT', { has_active_expert: true })).toEqual({ canDecide: true, isExpert: true, ownerReadOnly: false })
  })

  it('Farm Owner của farm chưa có chuyên gia quyết định thay, nhưng không làm việc chỉ của chuyên gia', () => {
    expect(expertDecisionRights('FARM_OWNER', { has_active_expert: false })).toEqual({ canDecide: true, isExpert: false, ownerReadOnly: false })
  })

  it('Farm Owner của farm có chuyên gia chỉ xem', () => {
    expect(expertDecisionRights('FARM_OWNER', { has_active_expert: true })).toEqual({ canDecide: false, isExpert: false, ownerReadOnly: true })
  })

  it('chưa biết farm (đang tải) thì Farm Owner chỉ xem, không mở nút ghi rồi nhận 403', () => {
    expect(expertDecisionRights('FARM_OWNER', undefined)).toMatchObject({ canDecide: false, ownerReadOnly: true })
  })
})
