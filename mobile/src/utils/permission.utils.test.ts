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

  it('nhóm A của BR-22: chủ trại sửa dù farm có chuyên gia hay chưa, chuyên gia sửa, kỹ thuật viên không', () => {
    const groupAActions = [
      'editThresholds',
      'editFuzzyTuning',
      'editDetectionTuning',
      'editBirdCountTuning',
      'editCountingSchedule',
      'editHealthLevels',
    ] as const
    for (const action of groupAActions) {
      expect(canPerform(buildUser('FARM_OWNER'), action, { farmHasExpert: true })).toBe(true)
      expect(canPerform(buildUser('FARM_OWNER'), action, { farmHasExpert: false })).toBe(true)
      expect(canPerform(buildUser('FARM_OWNER'), action)).toBe(true)
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action)).toBe(true)
      expect(canPerform(buildUser('FARM_TECHNICIAN'), action)).toBe(false)
    }
  })

  it('gợi ý hệ số: chuyên gia luôn áp dụng; chủ trại chỉ khi farm chưa có chuyên gia (BR-22)', () => {
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'applyCoefficientSuggestion', { farmHasExpert: true })).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'applyCoefficientSuggestion', { farmHasExpert: false })).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'applyCoefficientSuggestion', { farmHasExpert: true })).toBe(false)
    // Chưa biết farm có chuyên gia hay không thì không mở nút
    expect(canPerform(buildUser('FARM_OWNER'), 'applyCoefficientSuggestion')).toBe(false)
  })

  it('vòng đếm: chuyên gia, kỹ thuật viên và chủ trại vẽ; farm có chuyên gia thì vòng của chủ trại mở mục duyệt (VISION-FR-018, BR-22)', () => {
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'drawCountingRing')).toBe(true)
    expect(canPerform(buildUser('FARM_TECHNICIAN'), 'drawCountingRing')).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'drawCountingRing', { farmHasExpert: false })).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'drawCountingRing', { farmHasExpert: true })).toBe(true)
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
    // G-21: xác nhận cảnh báo, trả lời kiểm tra tại chỗ, làm Work Order của nhà được giao; backend chưa cho xem bằng chứng,
    // gợi ý hệ số
    expect(canPerform(technician, 'acknowledgeAlert')).toBe(true)
    expect(canPerform(technician, 'answerOnsiteCheck')).toBe(true)
    expect(canPerform(technician, 'workOnWorkOrder')).toBe(true)
    expect(canPerform(technician, 'viewAssignedWorkOrdersOnly')).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'answerOnsiteCheck')).toBe(false)
    expect(canPerform(buildUser('FARM_OWNER'), 'workOnWorkOrder')).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'viewAssignedWorkOrdersOnly')).toBe(false)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'viewWorkOrders')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'workOnWorkOrder')).toBe(false)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'answerOnsiteCheck')).toBe(false)
    // G-22: xem kế hoạch bảo trì ở nhà được giao; tạo, sửa kế hoạch là việc của chủ trại trên web
    expect(canPerform(technician, 'viewMaintenance')).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'viewMaintenance')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'viewMaintenance')).toBe(true)
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

  it('xác nhận lô thu hoạch DRAFT và xem kỹ thuật viên phụ trách: chỉ chủ trại (HARVEST-FR-006, AUTH-FR-013)', () => {
    for (const action of ['confirmHarvest', 'viewHouseTechnicians'] as const) {
      expect(canPerform(buildUser('FARM_OWNER'), action)).toBe(true)
      expect(canPerform(buildUser('FARM_TECHNICIAN'), action)).toBe(false)
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action)).toBe(false)
    }
  })

  it('khởi động lại controller: chủ trại và kỹ thuật viên nhà được giao, chuyên gia không (FARM-FR-013)', () => {
    expect(canPerform(buildUser('FARM_OWNER'), 'restartController')).toBe(true)
    expect(canPerform(buildUser('FARM_TECHNICIAN'), 'restartController')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'restartController')).toBe(false)
  })

  it('giai đoạn nhà: chủ trại và chuyên gia đổi, kỹ thuật viên chỉ xem (FARM-FR-014)', () => {
    expect(canPerform(buildUser('FARM_OWNER'), 'setHouseStage')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'setHouseStage')).toBe(true)
    expect(canPerform(buildUser('FARM_TECHNICIAN'), 'setHouseStage')).toBe(false)
  })

  it('phiếu công việc: chỉ chủ trại mở tay và duyệt, mở lại, huỷ, giao lại (OPS-FR-001, 004)', () => {
    for (const action of ['createWorkOrder', 'decideWorkOrder'] as const) {
      expect(canPerform(buildUser('FARM_OWNER'), action)).toBe(true)
      expect(canPerform(buildUser('FARM_TECHNICIAN'), action)).toBe(false)
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action)).toBe(false)
    }
  })

  it('khuyến nghị: chủ trại, chuyên gia xem (kỹ thuật viên chỉ xem được theo nhà, chưa mở); chỉ chủ trại quyết (EXPERT-FR-018)', () => {
    expect(canPerform(buildUser('FARM_TECHNICIAN'), 'viewRecommendations')).toBe(false)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'viewRecommendations')).toBe(true)
    expect(canPerform(buildUser('FARM_OWNER'), 'decideRecommendation')).toBe(true)
    expect(canPerform(buildUser('FARM_TECHNICIAN'), 'decideRecommendation')).toBe(false)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'decideRecommendation')).toBe(false)
  })

  it('đặt thẳng luật thời tiết, xem ngày lệch: chuyên gia; chủ trại chỉ khi farm chưa có chuyên gia (BR-22 nhóm B, C)', () => {
    for (const action of ['editWeatherRules', 'reviewDisagreements'] as const) {
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action, { farmHasExpert: true })).toBe(true)
      expect(canPerform(buildUser('FARM_OWNER'), action, { farmHasExpert: false })).toBe(true)
      expect(canPerform(buildUser('FARM_OWNER'), action, { farmHasExpert: true })).toBe(false)
      expect(canPerform(buildUser('FARM_TECHNICIAN'), action, { farmHasExpert: false })).toBe(false)
    }
  })

  it('chưa đăng nhập thì không được thao tác nào', () => {
    expect(canPerform(null, 'setupDevice')).toBe(false)
  })
})
