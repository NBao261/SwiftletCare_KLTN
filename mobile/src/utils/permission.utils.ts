import type { Role, User } from '@/types'

// Thao tác cần kiểm quyền trên mobile — thêm dần theo bảng ở MOBILE_GUIDE 2.1
export type PermissionAction =
  | 'setupDevice'
  | 'clearRelayOverride'
  | 'viewOwnerTasks'
  | 'createFarm'
  | 'createHouse'
  | 'registerCamera'

// Role được làm từng thao tác (Report 3 §2.4); Technician và Admin không vào app
const ALLOWED_ROLES: Record<PermissionAction, readonly Role[]> = {
  // Thiết lập thiết bị bằng QR (MF-10): chỉ Farm Owner, Domain Expert chỉ xem thiết bị
  setupDevice: ['FARM_OWNER'],
  // Trả relay về tự động (ENV-FR-018): chỉ Farm Owner, chuyên gia chỉ xem
  clearRelayOverride: ['FARM_OWNER'],
  // Khối "Việc chờ bạn" và "Báo cáo mới" ở Trang chủ: việc của chủ trại
  viewOwnerTasks: ['FARM_OWNER'],
  // Tạo trang trại, nhà yến (FARM-FR-001, 002): chỉ chủ trại — Admin không tạo farm thay chủ (Report 3 §8)
  createFarm: ['FARM_OWNER'],
  createHouse: ['FARM_OWNER'],
  // Đăng ký camera AI cho nhà (FARM-FR-004, MF-06): chủ trại; chuyên gia chỉ xem
  registerCamera: ['FARM_OWNER'],
}

// Chỗ duy nhất quyết định nút thao tác nào hiện — màn hình không tự so user.role
export function canPerform(user: User | null, action: PermissionAction): boolean {
  if (!user) return false
  return ALLOWED_ROLES[action].includes(user.role)
}
