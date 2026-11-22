import { describe, expect, it } from 'vitest'

import { expertDecisionRights } from '@/hooks/domain-expert/expertDecisionRights'

describe('expertDecisionRights (BR-22, Report 3 4.2.15)', () => {
  it('Domain Expert quyết định mọi việc của chuyên gia', () => {
    expect(expertDecisionRights('DOMAIN_EXPERT', { has_active_expert: true })).toEqual({
      canDecide: true, canEditParameters: true, ownerNeedsExpert: false, isExpert: true, ownerReadOnly: false, farmKnown: true,
    })
  })

  it('Farm Owner của farm chưa có chuyên gia quyết định thay, nhưng không làm việc chỉ của chuyên gia', () => {
    expect(expertDecisionRights('FARM_OWNER', { has_active_expert: false })).toEqual({
      canDecide: true, canEditParameters: true, ownerNeedsExpert: false, isExpert: false, ownerReadOnly: false, farmKnown: true,
    })
  })

  it('Farm Owner của farm có chuyên gia sửa tham số (chuyên gia duyệt sau), không kết luận cảnh báo', () => {
    expect(expertDecisionRights('FARM_OWNER', { has_active_expert: true })).toEqual({
      canDecide: false, canEditParameters: true, ownerNeedsExpert: true, isExpert: false, ownerReadOnly: true, farmKnown: true,
    })
  })

  it('chưa biết farm (đang tải) thì Farm Owner chưa ghi được gì, không mở nút ghi rồi nhận 403', () => {
    expect(expertDecisionRights('FARM_OWNER', undefined)).toMatchObject({
      canDecide: false, canEditParameters: false, ownerNeedsExpert: false, ownerReadOnly: true, farmKnown: false,
    })
  })
})
