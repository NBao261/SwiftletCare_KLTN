import { describe, expect, it } from '@jest/globals'
import type { FarmMember } from '@/types'
import {
  getActivityVerdict,
  getDaysLeft,
  getDeletionDeadline,
  getExpertActionLabel,
  getMemberRoleLabel,
  isReviewPending,
  sortMembers,
} from '@/utils/account.utils'

function buildMember(userId: string, extra: Partial<FarmMember> = {}): FarmMember {
  return { user_id: userId, is_primary: false, joined_at: '2026-10-01T00:00:00.000Z', ...extra }
}

describe('thành viên farm', () => {
  it('gọi đúng vai trò: chủ chính, đồng sở hữu (kể cả member cũ không có role), chuyên gia', () => {
    expect(getMemberRoleLabel(buildMember('owner', { is_primary: true }), 'owner')).toBe('Chủ chính')
    expect(getMemberRoleLabel(buildMember('owner'), 'owner')).toBe('Chủ chính')
    expect(getMemberRoleLabel(buildMember('co-owner'), 'owner')).toBe('Đồng sở hữu')
    expect(getMemberRoleLabel(buildMember('expert', { role: 'DOMAIN_EXPERT' }), 'owner')).toBe('Chuyên gia')
  })

  it('xếp chủ chính, rồi đồng sở hữu, rồi chuyên gia; cùng nhóm thì vào trước đứng trước', () => {
    const members = [
      buildMember('expert', { role: 'DOMAIN_EXPERT' }),
      buildMember('co-owner-late', { joined_at: '2026-10-05T00:00:00.000Z' }),
      buildMember('owner', { is_primary: true }),
      buildMember('co-owner-early', { joined_at: '2026-10-02T00:00:00.000Z' }),
    ]
    expect(sortMembers(members, 'owner').map(member => member.user_id)).toEqual([
      'owner',
      'co-owner-early',
      'co-owner-late',
      'expert',
    ])
  })
})

describe('các hàm phụ của trang Tài khoản', () => {
  it('đếm ngày còn lại, quá hạn thì 0', () => {
    const now = Date.parse('2026-11-02T00:00:00.000Z')
    expect(getDaysLeft('2026-11-09T00:00:00.000Z', now)).toBe(7)
    expect(getDaysLeft('2026-11-02T12:00:00.000Z', now)).toBe(1)
    expect(getDaysLeft('2026-11-01T00:00:00.000Z', now)).toBe(0)
  })

  it('hạn xử lý yêu cầu xoá là 30 ngày sau khi gửi', () => {
    expect(getDeletionDeadline('2026-11-02T00:00:00.000Z')).toBe('2026-12-02T00:00:00.000Z')
  })

  it('mục chờ duyệt và đề xuất đã gửi là còn chờ', () => {
    expect(isReviewPending('PENDING_REVIEW')).toBe(true)
    expect(isReviewPending('PROPOSED')).toBe(true)
    expect(isReviewPending('ACCEPTED')).toBe(false)
  })

  it('tên quyết định theo mã action của backend, mã lạ thì "Quyết định khác"', () => {
    expect(getExpertActionLabel('ALERT_VERDICT_SET')).toBe('Phán quyết cảnh báo')
    expect(getExpertActionLabel('SOMETHING_NEW')).toBe('Quyết định khác')
  })

  it('đọc kết quả phán quyết trong metadata, giá trị lạ thì null', () => {
    expect(getActivityVerdict({ result: 'REJECTED' })).toBe('REJECTED')
    expect(getActivityVerdict({ result: 'MAYBE' })).toBeNull()
    expect(getActivityVerdict(undefined)).toBeNull()
  })
})
