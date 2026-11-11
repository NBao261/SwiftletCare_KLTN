import { describe, expect, it } from '@jest/globals'
import type { FarmMember } from '@/types'
import {
  describeActivityChanges,
  getActivityVerdict,
  getDaysLeft,
  getDeletionDeadline,
  getExpertActionLabel,
  getMemberRoleLabel,
  humanizeChangeText,
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
    expect(getMemberRoleLabel(buildMember('tech', { role: 'FARM_TECHNICIAN' }), 'owner')).toBe('Kỹ thuật viên nhà yến')
  })

  it('xếp chủ chính, rồi đồng sở hữu, chuyên gia, kỹ thuật viên; cùng nhóm thì vào trước đứng trước', () => {
    const members = [
      buildMember('tech', { role: 'FARM_TECHNICIAN' }),
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
      'tech',
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

describe('describeActivityChanges', () => {
  it('ghi rõ ngưỡng nào đổi, từ bao nhiêu thành bao nhiêu, bỏ giá trị không đổi', () => {
    const lines = describeActivityChanges({
      action: 'THRESHOLD_UPDATED',
      metadata: {
        source: 'MANUAL',
        before: { temp_min: 26, temp_max: 32, humidity_min: 75 },
        after: { temp_min: 26, temp_max: 33.5, humidity_min: 80 },
      },
    })
    expect(lines).toEqual(['Nhiệt độ cao nhất: 32°C → 33,5°C', 'Độ ẩm thấp nhất: 75% → 80%'])
  })

  it('đặt lại mặc định và áp gợi ý ghi thêm dòng nguồn; công tắc lọc nhiễu ghi Bật / Tắt', () => {
    expect(
      describeActivityChanges({ action: 'THRESHOLD_UPDATED', metadata: { source: 'RESET_TO_DEFAULT', before: { nh3_max: 25 }, after: { nh3_max: 20 } } }),
    ).toEqual(['Đặt lại về mặc định hệ thống', 'NH3 tối đa: 25 ppm → 20 ppm'])
    expect(
      describeActivityChanges({
        action: 'FUZZY_TUNING_UPDATED',
        metadata: { source: 'SUGGESTION_APPROVED', before: { fuzzy_input_filter: true }, after: { fuzzy_input_filter: false } },
      }),
    ).toEqual(['Áp gợi ý hệ số của hệ thống', 'Lọc nhiễu đầu vào: Bật → Tắt'])
  })

  it('tham số phát hiện, mức giảm tỷ lệ về tổ dùng đúng tên trên màn cài đặt; khoá lạ không hiện mã thô', () => {
    expect(
      describeActivityChanges({
        action: 'DETECTION_TUNING_UPDATED',
        metadata: { before: { noise_margin_db: 15, unknown_key: 1 }, after: { noise_margin_db: 18, unknown_key: 2 } },
      }),
    ).toEqual(['Ồn vượt mức nền: 15 dB → 18 dB'])
    expect(
      describeActivityChanges({ action: 'BIRD_COUNT_TUNING_UPDATED', metadata: { before: { return_rate_drop_pct: 20 }, after: { return_rate_drop_pct: 25 } } }),
    ).toEqual(['Tỷ lệ về tổ giảm: 20% → 25%'])
  })

  it('vòng đếm ghi số đỉnh và phía; từ chối gợi ý ghi lý do, phán quyết ghi ghi chú', () => {
    expect(
      describeActivityChanges({ action: 'COUNTING_RING_UPDATED', metadata: { before: null, after: { points: [1, 2, 3, 4], into_ring_is_exit: false } } }),
    ).toEqual(['Vòng đếm 4 đỉnh, trong vòng là phía trong nhà'])
    expect(describeActivityChanges({ action: 'PROPOSAL_REJECTED', metadata: { note: ' Chưa đủ dữ liệu ' } })).toEqual([
      'Lý do: Chưa đủ dữ liệu',
    ])
    expect(describeActivityChanges({ action: 'ALERT_VERDICT_SET', metadata: { result: 'REJECTED', note: 'Báo nhầm' } })).toEqual([
      'Ghi chú: Báo nhầm',
    ])
  })
})

describe('humanizeChangeText', () => {
  it('đổi mã trường trong nội dung thông báo sang tên chỉ số kèm đơn vị, giữ phần chữ khác và khoá lạ', () => {
    expect(humanizeChangeText('Khu vực "Tầng 2" — 11/11/2026 14:30. humidity_min 75 → 80, fuzzy_input_filter true → false')).toBe(
      'Khu vực "Tầng 2" — 11/11/2026 14:30. Độ ẩm thấp nhất: 75% → 80%, Lọc nhiễu đầu vào: Bật → Tắt',
    )
    expect(humanizeChangeText('temp_max null → 33.5')).toBe('Nhiệt độ cao nhất: 33,5°C')
    expect(humanizeChangeText('la_ma 1 → 2')).toBe('la_ma 1 → 2')
  })
})
