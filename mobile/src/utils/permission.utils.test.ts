import { describe, expect, it } from '@jest/globals'
import type { Role, User } from '@/types'
import { canPerform } from '@/utils/permission.utils'

// Tài khoản mẫu chỉ khác nhau ở role
function buildUser(role: Role): User {
  return {
    _id: 'user-1',
    email: 'user@swiftletcare.dev',
    full_name: 'Nguyễn Vũ Len',
    role,
    is_active: true,
    notification_preferences: { push: true, telegram: false, quiet_hours: { start: '22:00', end: '06:00' } },
    created_at: '2026-10-30T00:00:00.000Z',
  }
}

describe('canPerform', () => {
  it('chỉ Farm Owner được thiết lập thiết bị bằng QR (MF-10)', () => {
    expect(canPerform(buildUser('FARM_OWNER'), 'setupDevice')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'setupDevice')).toBe(false)
  })

  it('chỉ Farm Owner được điều khiển tay relay; chuyên gia chỉ xem', () => {
    expect(canPerform(buildUser('FARM_OWNER'), 'controlRelay')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'controlRelay')).toBe(false)
  })

  it('chỉ Farm Owner được trả relay về tự động; chuyên gia chỉ xem', () => {
    expect(canPerform(buildUser('FARM_OWNER'), 'clearRelayOverride')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'clearRelayOverride')).toBe(false)
  })

  it('chỉ Farm Owner tạo trang trại, nhà yến và đăng ký camera', () => {
    for (const action of ['createFarm', 'createHouse', 'registerCamera'] as const) {
      expect(canPerform(buildUser('FARM_OWNER'), action)).toBe(true)
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action)).toBe(false)
    }
  })

  it('chỉ Farm Owner sửa, xoá farm và tạo zone', () => {
    for (const action of ['editFarm', 'deleteFarm', 'createZone'] as const) {
      expect(canPerform(buildUser('FARM_OWNER'), action)).toBe(true)
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action)).toBe(false)
    }
  })

  it('ngưỡng và hệ số mờ: chủ trại và chuyên gia; tham số phát hiện, mức giảm tỷ lệ về tổ: chỉ chuyên gia', () => {
    for (const action of ['editThresholds', 'editFuzzyTuning'] as const) {
      expect(canPerform(buildUser('FARM_OWNER'), action)).toBe(true)
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action)).toBe(true)
    }
    for (const action of ['editDetectionTuning', 'editBirdCountTuning'] as const) {
      expect(canPerform(buildUser('FARM_OWNER'), action)).toBe(false)
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action)).toBe(true)
    }
  })

  it('gợi ý hệ số: chuyên gia luôn áp dụng; chủ trại chỉ khi farm chưa có chuyên gia (BR-22)', () => {
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'applyCoefficientSuggestion', { farmHasExpert: true })).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'applyCoefficientSuggestion', { farmHasExpert: false })).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'applyCoefficientSuggestion', { farmHasExpert: true })).toBe(false)
    // Chưa biết farm có chuyên gia hay không thì không mở nút
    expect(canPerform(buildUser('FARM_OWNER'), 'applyCoefficientSuggestion')).toBe(false)
  })

  it('chỉ chuyên gia viết kết luận báo cáo', () => {
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'writeConclusion')).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'writeConclusion')).toBe(false)
  })

  it('cảnh báo: chủ trại xác nhận và cài thông báo; chuyên gia phán quyết', () => {
    expect(canPerform(buildUser('FARM_OWNER'), 'acknowledgeAlert')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'acknowledgeAlert')).toBe(false)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'setAlertVerdict')).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'setAlertVerdict')).toBe(false)
    expect(canPerform(buildUser('FARM_OWNER'), 'editNotificationSettings')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'editNotificationSettings')).toBe(false)
  })

  it('chưa đăng nhập thì không được thao tác nào', () => {
    expect(canPerform(null, 'setupDevice')).toBe(false)
  })
})
