import type { Role } from '@/types'

export interface ExpertDecisionRights {
  // Ghi được quyết định mà BR-22 cho Farm Owner làm thay khi farm chưa có chuyên gia
  // (kết luận cảnh báo, tham số phát hiện, mức giảm tỷ lệ chim về, vòng đếm, lịch đếm, luật thời tiết)
  canDecide: boolean
  // Việc chỉ Domain Expert làm, kể cả khi farm chưa có chuyên gia: duyệt mục duyệt và đề xuất, soạn và duyệt hồ sơ,
  // luật khuyến nghị, kết luận báo cáo và mùa vụ (Report 3 §2.4, BR-22 "no conclusions without an expert")
  isExpert: boolean
  // Farm Owner xem trang chuyên gia ở chế độ chỉ xem vì farm đã có chuyên gia
  ownerReadOnly: boolean
  // Đã biết farm có chuyên gia hay chưa (GET /farms đã tải và có farm đang chọn); chưa biết thì vẫn khoá nút ghi
  farmKnown: boolean
}

// BR-22, Report 4 §5.4 — quyền trên các trang quyết định của chuyên gia; backend vẫn là nơi quyết cuối cùng
export function expertDecisionRights(role: Role | undefined, farm: { has_active_expert?: boolean } | undefined): ExpertDecisionRights {
  const isExpert = role === 'DOMAIN_EXPERT'
  const ownerCanDecide = role === 'FARM_OWNER' && farm?.has_active_expert === false
  return {
    canDecide: isExpert || ownerCanDecide,
    isExpert,
    ownerReadOnly: role === 'FARM_OWNER' && !ownerCanDecide,
    farmKnown: typeof farm?.has_active_expert === 'boolean',
  }
}
