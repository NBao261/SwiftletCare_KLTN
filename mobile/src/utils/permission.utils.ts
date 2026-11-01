import type { Role, User } from '@/types'

// Thao tác cần kiểm quyền trên mobile — thêm dần theo bảng ở MOBILE_GUIDE 2.1
export type PermissionAction =
  | 'setupDevice'
  | 'controlRelay'
  | 'clearRelayOverride'
  | 'viewOwnerTasks'
  | 'createFarm'
  | 'createHouse'
  | 'registerCamera'
  | 'editFarm'
  | 'deleteFarm'
  | 'createZone'
  | 'editThresholds'
  | 'editFuzzyTuning'
  | 'editDetectionTuning'
  | 'editBirdCountTuning'
  | 'applyCoefficientSuggestion'
  | 'writeConclusion'
  | 'acknowledgeAlert'
  | 'setAlertVerdict'
  | 'editNotificationSettings'

// Role được làm từng thao tác (Report 3 §2.4); Technician và Admin không vào app
const ALLOWED_ROLES: Record<PermissionAction, readonly Role[]> = {
  // Thiết lập thiết bị bằng QR (MF-10): chỉ Farm Owner, Domain Expert chỉ xem thiết bị
  setupDevice: ['FARM_OWNER'],
  // Điều khiển tay một relay (ENV-FR-016): chỉ Farm Owner, chuyên gia chỉ xem (Report 3 §2.4)
  controlRelay: ['FARM_OWNER'],
  // Trả relay về tự động (ENV-FR-018): chỉ Farm Owner, chuyên gia chỉ xem
  clearRelayOverride: ['FARM_OWNER'],
  // Khối "Việc chờ bạn" và "Báo cáo mới" ở Trang chủ: việc của chủ trại
  viewOwnerTasks: ['FARM_OWNER'],
  // Tạo trang trại, nhà yến (FARM-FR-001, 002): chỉ chủ trại — Admin không tạo farm thay chủ (Report 3 §8)
  createFarm: ['FARM_OWNER'],
  createHouse: ['FARM_OWNER'],
  // Đăng ký camera AI cho nhà (FARM-FR-004, MF-06): chủ trại; chuyên gia chỉ xem
  registerCamera: ['FARM_OWNER'],
  // Sửa thông tin, toạ độ farm (FARM-FR-001): chỉ chủ trại
  editFarm: ['FARM_OWNER'],
  // Xoá farm: chỉ chủ trại, và backend chỉ cho chủ chính (màn kiểm thêm owner_id)
  deleteFarm: ['FARM_OWNER'],
  // Tạo zone trong nhà (FARM-FR-002): chỉ chủ trại
  createZone: ['FARM_OWNER'],
  // Ngưỡng và hệ số bộ điều khiển mờ thuộc farm: chủ trại và chuyên gia sửa (ENV-FR-006, ENV-FR-021)
  editThresholds: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  editFuzzyTuning: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  // Tham số phát hiện của zone và mức giảm tỷ lệ về tổ của nhà: chỉ chuyên gia (EXPERT-FR-008)
  editDetectionTuning: ['DOMAIN_EXPERT'],
  editBirdCountTuning: ['DOMAIN_EXPERT'],
  // Áp dụng gợi ý hệ số (EXPERT-FR-011): chuyên gia; chủ trại chỉ khi farm chưa có chuyên gia (BR-22, xem FARM_OWNER_WITHOUT_EXPERT)
  applyCoefficientSuggestion: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  // Viết kết luận báo cáo (EXPERT-FR-006): chỉ chuyên gia
  writeConclusion: ['DOMAIN_EXPERT'],
  // Xác nhận đã biết cảnh báo (ALERT-FR-009): chỉ chủ trại, chuyên gia bị 403
  acknowledgeAlert: ['FARM_OWNER'],
  // Phán quyết cảnh báo suy luận (EXPERT-FR-003): backend chỉ cho chuyên gia; BR-22 (chủ trại khi farm chưa có
  // chuyên gia) backend chưa làm nên chưa mở cho chủ trại
  setAlertVerdict: ['DOMAIN_EXPERT'],
  // Kênh push, Telegram, giờ yên lặng (ALERT-FR-005, 006, 013): chuyên gia không nhận push, Telegram
  editNotificationSettings: ['FARM_OWNER'],
}

// Thao tác chủ trại chỉ được làm khi farm chưa có chuyên gia (BR-22); có chuyên gia thì việc đó của chuyên gia
const FARM_OWNER_WITHOUT_EXPERT: ReadonlySet<PermissionAction> = new Set(['applyCoefficientSuggestion'])

export interface PermissionContext {
  // Farm đang xem có thành viên DOMAIN_EXPERT (utils/farm.utils farmHasExpert)
  farmHasExpert?: boolean
}

// Chỗ duy nhất quyết định nút thao tác nào hiện — màn hình không tự so user.role
export function canPerform(user: User | null, action: PermissionAction, context: PermissionContext = {}): boolean {
  if (!user) return false
  if (!ALLOWED_ROLES[action].includes(user.role)) return false
  if (user.role === 'FARM_OWNER' && FARM_OWNER_WITHOUT_EXPERT.has(action)) return context.farmHasExpert === false
  return true
}
