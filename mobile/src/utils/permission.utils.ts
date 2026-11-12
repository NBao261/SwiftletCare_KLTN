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
  | 'viewOwnerProfile'
  | 'viewBell'
  | 'viewHealthReports'
  | 'viewAlertEvidence'
  | 'viewControlSuggestion'
  | 'limitedToAssignedHouses'
  | 'viewFarmMembers'
  | 'manageFarmMembers'

// Role được làm từng thao tác (Report 3 §2.4); Admin không vào app. Farm Technician (G-20) chỉ thấy và thao tác trên nhà được
// giao — backend chỉ trả nhà, tầng, thiết bị, cảnh báo của các nhà đó và trả 403 ở nhà khác (AUTH-FR-013)
const ALLOWED_ROLES: Record<PermissionAction, readonly Role[]> = {
  // Thiết lập thiết bị bằng QR (SF-01): chỉ Farm Owner, Domain Expert chỉ xem thiết bị
  setupDevice: ['FARM_OWNER'],
  // Điều khiển tay một relay (ENV-FR-016): Farm Owner và kỹ thuật viên nhà được giao, chuyên gia chỉ xem (Report 3 §2.4)
  controlRelay: ['FARM_OWNER', 'FARM_TECHNICIAN'],
  // Trả relay về tự động (ENV-FR-018): cùng quyền với điều khiển tay
  clearRelayOverride: ['FARM_OWNER', 'FARM_TECHNICIAN'],
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
  // Ngưỡng và hệ số bộ điều khiển fuzzy thuộc farm: chủ trại và chuyên gia sửa (ENV-FR-006, ENV-FR-021)
  editThresholds: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  editFuzzyTuning: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  // Tham số phát hiện của zone và mức giảm tỷ lệ về tổ của nhà (EXPERT-FR-008): chuyên gia; chủ trại chỉ khi farm chưa
  // có chuyên gia (BR-22, backend assertExpertDecision)
  editDetectionTuning: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  editBirdCountTuning: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  // Áp dụng gợi ý hệ số (EXPERT-FR-011): chuyên gia; chủ trại chỉ khi farm chưa có chuyên gia (BR-22, xem FARM_OWNER_WITHOUT_EXPERT)
  applyCoefficientSuggestion: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  // Viết kết luận báo cáo (EXPERT-FR-006): chỉ chuyên gia
  writeConclusion: ['DOMAIN_EXPERT'],
  // Xác nhận đã biết cảnh báo (ALERT-FR-009): chủ trại; chuyên gia 403. Report 3 §2.4 cho cả kỹ thuật viên nhà được giao, nhưng
  // backend G-20 (PUT /alerts/{id}/acknowledge) mới cho FARM_OWNER — thêm FARM_TECHNICIAN khi backend mở
  acknowledgeAlert: ['FARM_OWNER'],
  // Phán quyết cảnh báo suy luận (EXPERT-FR-003): chuyên gia; chủ trại chỉ khi farm chưa có chuyên gia (BR-22)
  setAlertVerdict: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  // Kênh push, Telegram, giờ yên lặng (ALERT-FR-005, 006, 013): chủ trại và kỹ thuật viên (nhận cảnh báo đầu tiên của nhà được
  // giao); chuyên gia không nhận push, Telegram
  editNotificationSettings: ['FARM_OWNER', 'FARM_TECHNICIAN'],
  // Trang Tài khoản đầy đủ (hồ sơ, lối tắt, thành viên, bảo mật): làm cho Farm Owner; Domain Expert, kỹ thuật viên giữ trang cơ bản
  viewOwnerProfile: ['FARM_OWNER'],
  // Chuông (hộp thông báo + cảnh báo chờ xác nhận): người nhận và xác nhận cảnh báo — chủ trại, kỹ thuật viên
  viewBell: ['FARM_OWNER', 'FARM_TECHNICIAN'],
  // Báo cáo sức khỏe, bằng chứng cảnh báo suy luận, gợi ý hệ số: backend G-20 mới cho chủ trại và chuyên gia (/health-reports,
  // /alerts/{id}/evidence, /analytics/control/suggestion trả 403 cho kỹ thuật viên) — mở cho kỹ thuật viên khi backend mở
  viewHealthReports: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  viewAlertEvidence: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  viewControlSuggestion: ['FARM_OWNER', 'DOMAIN_EXPERT'],
  // Chỉ thấy các nhà được giao (AUTH-FR-013): danh sách trống nghĩa là chưa được giao nhà, không phải farm chưa có nhà
  limitedToAssignedHouses: ['FARM_TECHNICIAN'],
  // Xem thành viên farm: Farm Owner (GET /farms/{id} chỉ trả bản ghi của chính chuyên gia)
  viewFarmMembers: ['FARM_OWNER'],
  // Mời, gỡ thành viên (AUTH-FR-005, EXPERT-FR-001): Farm Owner và phải là chủ chính, xem PRIMARY_OWNER_ONLY
  manageFarmMembers: ['FARM_OWNER'],
}

// Thao tác chủ trại chỉ được làm khi farm chưa có chuyên gia (BR-22); có chuyên gia thì việc đó của chuyên gia
const FARM_OWNER_WITHOUT_EXPERT: ReadonlySet<PermissionAction> = new Set([
  'applyCoefficientSuggestion',
  'setAlertVerdict',
  'editDetectionTuning',
  'editBirdCountTuning',
])

// Thao tác backend chỉ cho Primary Owner (người tạo farm); đồng sở hữu chỉ xem
const PRIMARY_OWNER_ONLY: ReadonlySet<PermissionAction> = new Set(['manageFarmMembers'])

export interface PermissionContext {
  // Farm đang xem có thành viên DOMAIN_EXPERT (utils/farm.utils farmHasExpert)
  farmHasExpert?: boolean
  // Người dùng là Primary Owner của farm đang xem (farm.owner_id === user._id)
  isPrimaryOwner?: boolean
}

// Chỗ duy nhất quyết định nút thao tác nào hiện — màn hình không tự so user.role
export function canPerform(user: User | null, action: PermissionAction, context: PermissionContext = {}): boolean {
  if (!user) return false
  if (!ALLOWED_ROLES[action].includes(user.role)) return false
  if (user.role === 'FARM_OWNER' && FARM_OWNER_WITHOUT_EXPERT.has(action)) return context.farmHasExpert === false
  if (PRIMARY_OWNER_ONLY.has(action)) return context.isPrimaryOwner === true
  return true
}
