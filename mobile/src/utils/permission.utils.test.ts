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
  it('chỉ Farm Owner được thiết lập thiết bị bằng QR (SF-01)', () => {
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

  it('chỉ Farm Owner tạo trang trại, nhà yến, đăng ký camera và xác nhận cảnh báo (BZ-16)', () => {
    for (const action of ['createFarm', 'createHouse', 'registerCamera', 'acknowledgeAlert'] as const) {
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

  it('ngưỡng và hệ số fuzzy: chủ trại và chuyên gia; tham số phát hiện, mức giảm tỷ lệ về tổ: chuyên gia, chủ trại khi farm chưa có chuyên gia', () => {
    for (const action of ['editThresholds', 'editFuzzyTuning'] as const) {
      expect(canPerform(buildUser('FARM_OWNER'), action)).toBe(true)
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action)).toBe(true)
    }
    for (const action of ['editDetectionTuning', 'editBirdCountTuning'] as const) {
      expect(canPerform(buildUser('FARM_OWNER'), action, { farmHasExpert: true })).toBe(false)
      expect(canPerform(buildUser('FARM_OWNER'), action, { farmHasExpert: false })).toBe(true)
      expect(canPerform(buildUser('FARM_OWNER'), action)).toBe(false)
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action, { farmHasExpert: true })).toBe(true)
    }
  })

  it('gợi ý hệ số: chuyên gia luôn áp dụng; chủ trại chỉ khi farm chưa có chuyên gia (BR-22)', () => {
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'applyCoefficientSuggestion', { farmHasExpert: true })).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'applyCoefficientSuggestion', { farmHasExpert: false })).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'applyCoefficientSuggestion', { farmHasExpert: true })).toBe(false)
    // Chưa biết farm có chuyên gia hay không thì không mở nút
    expect(canPerform(buildUser('FARM_OWNER'), 'applyCoefficientSuggestion')).toBe(false)
  })

  it('vòng đếm: chuyên gia và kỹ thuật viên vẽ; chủ trại chỉ khi farm chưa có chuyên gia (VISION-FR-018, BR-22)', () => {
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'drawCountingRing')).toBe(true)
    expect(canPerform(buildUser('FARM_TECHNICIAN'), 'drawCountingRing')).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'drawCountingRing', { farmHasExpert: false })).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'drawCountingRing', { farmHasExpert: true })).toBe(false)
    expect(canPerform(buildUser('FARM_OWNER'), 'drawCountingRing')).toBe(false)
  })

  it('chỉ chuyên gia viết kết luận báo cáo', () => {
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'writeConclusion')).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'writeConclusion')).toBe(false)
  })

  it('cảnh báo: chủ trại xác nhận và cài thông báo; chuyên gia phán quyết', () => {
    expect(canPerform(buildUser('FARM_OWNER'), 'acknowledgeAlert')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'acknowledgeAlert')).toBe(false)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'setAlertVerdict')).toBe(true)
    // BR-22: chủ trại phán quyết thay chỉ khi farm chưa có chuyên gia
    expect(canPerform(buildUser('FARM_OWNER'), 'setAlertVerdict', { farmHasExpert: true })).toBe(false)
    expect(canPerform(buildUser('FARM_OWNER'), 'setAlertVerdict', { farmHasExpert: false })).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'setAlertVerdict')).toBe(false)
    expect(canPerform(buildUser('FARM_OWNER'), 'editNotificationSettings')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'editNotificationSettings')).toBe(false)
  })

  it('tài khoản: trang đầy đủ và xem thành viên chỉ cho chủ trại; mời, gỡ chỉ chủ chính', () => {
    expect(canPerform(buildUser('FARM_OWNER'), 'viewOwnerProfile')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'viewOwnerProfile')).toBe(false)
    expect(canPerform(buildUser('FARM_OWNER'), 'viewFarmMembers')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'viewFarmMembers')).toBe(false)
    expect(canPerform(buildUser('FARM_OWNER'), 'manageFarmMembers', { isPrimaryOwner: true })).toBe(true)
    // Đồng sở hữu, hoặc chưa biết có phải chủ chính không, thì chỉ xem
    expect(canPerform(buildUser('FARM_OWNER'), 'manageFarmMembers', { isPrimaryOwner: false })).toBe(false)
    expect(canPerform(buildUser('FARM_OWNER'), 'manageFarmMembers')).toBe(false)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'manageFarmMembers', { isPrimaryOwner: true })).toBe(false)
  })

  it('kỹ thuật viên nhà yến (G-20): điều khiển tay, cài thông báo, dùng chuông; không sửa cấu hình, không lập thiết bị', () => {
    const technician = buildUser('FARM_TECHNICIAN')
    // Backend chưa cho kỹ thuật viên xác nhận cảnh báo, xem bằng chứng, gợi ý hệ số
    expect(canPerform(technician, 'acknowledgeAlert')).toBe(false)
    // Chấm ngày, xem trạng thái ngày và báo cáo của nhà được giao (BR-31, G-11)
    expect(canPerform(technician, 'rateHealthDay')).toBe(true)
    expect(canPerform(technician, 'viewHealthReports')).toBe(true)
    expect(canPerform(technician, 'viewPendingRatings')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'rateHealthDay')).toBe(false)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'viewPendingRatings')).toBe(false)
    expect(canPerform(technician, 'viewAlertEvidence')).toBe(false)
    expect(canPerform(technician, 'viewControlSuggestion')).toBe(false)
    expect(canPerform(technician, 'limitedToAssignedHouses')).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'limitedToAssignedHouses')).toBe(false)
    expect(canPerform(buildUser('FARM_OWNER'), 'viewHealthReports')).toBe(true)
    expect(canPerform(technician, 'controlRelay')).toBe(true)
    expect(canPerform(technician, 'clearRelayOverride')).toBe(true)
    expect(canPerform(technician, 'editNotificationSettings')).toBe(true)
    expect(canPerform(technician, 'viewBell')).toBe(true)
    expect(canPerform(technician, 'setAlertVerdict', { farmHasExpert: false })).toBe(false)
    expect(canPerform(technician, 'editThresholds')).toBe(false)
    expect(canPerform(technician, 'editFuzzyTuning')).toBe(false)
    expect(canPerform(technician, 'editDetectionTuning', { farmHasExpert: false })).toBe(false)
    expect(canPerform(technician, 'setupDevice')).toBe(false)
    expect(canPerform(technician, 'registerCamera')).toBe(false)
    expect(canPerform(technician, 'createHouse')).toBe(false)
    expect(canPerform(technician, 'createZone')).toBe(false)
    expect(canPerform(technician, 'viewOwnerProfile')).toBe(false)
    expect(canPerform(technician, 'viewFarmMembers')).toBe(false)
    expect(canPerform(technician, 'viewOwnerTasks')).toBe(false)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'viewBell')).toBe(false)
  })

  it('chưa đăng nhập thì không được thao tác nào', () => {
    expect(canPerform(null, 'setupDevice')).toBe(false)
  })
})
