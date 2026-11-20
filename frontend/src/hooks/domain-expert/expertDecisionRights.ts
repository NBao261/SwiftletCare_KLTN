import type { Role } from '@/types'

export interface ExpertDecisionRights {
  // Nhóm C (BR-22, Report 3 4.2.15): kết luận cảnh báo suy luận — Domain Expert, hoặc Farm Owner khi farm chưa có chuyên gia
  canDecide: boolean
  // Nhóm A: tham số phát hiện, mức giảm tỷ lệ chim về, mức chỉ số sức khoẻ, lịch đếm, vòng đếm — Domain Expert và Farm Owner
  canEditParameters: boolean
  // Farm Owner trên farm có chuyên gia: thay đổi nhóm A mở mục duyệt, việc nhóm B gửi chuyên gia duyệt, nhóm C nhắc được
  ownerNeedsExpert: boolean
  // Việc chỉ Domain Expert làm, kể cả khi farm chưa có chuyên gia: duyệt, kết luận báo cáo và mùa vụ (BR-22)
  isExpert: boolean
  // Farm Owner xem kết luận cảnh báo ở chế độ chỉ xem vì farm đã có chuyên gia
  ownerReadOnly: boolean
  // Đã biết farm có chuyên gia hay chưa (GET /farms đã tải và có farm đang chọn); chưa biết thì vẫn khoá nút ghi
  farmKnown: boolean
}

// BR-22, Report 4 §5.4 — quyền trên các trang quyết định của chuyên gia; backend vẫn là nơi quyết cuối cùng
export function expertDecisionRights(role: Role | undefined, farm: { has_active_expert?: boolean } | undefined): ExpertDecisionRights {
  const isExpert = role === 'DOMAIN_EXPERT'
  const isOwner = role === 'FARM_OWNER'
  const farmKnown = typeof farm?.has_active_expert === 'boolean'
  const ownerCanDecide = isOwner && farm?.has_active_expert === false
  return {
    canDecide: isExpert || ownerCanDecide,
    // Chưa biết farm thì chưa mở cho Farm Owner: không đoán được thay đổi có mở mục duyệt hay không
    canEditParameters: isExpert || (isOwner && farmKnown),
    ownerNeedsExpert: isOwner && farm?.has_active_expert === true,
    isExpert,
    ownerReadOnly: isOwner && !ownerCanDecide,
    farmKnown,
  }
}
