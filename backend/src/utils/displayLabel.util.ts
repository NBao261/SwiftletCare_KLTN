import type { AlertSeverity, DeviceStatus, Role } from '@/types/domain.types'
import type { WorkOrderStatus } from '@/models/workOrder.model'
import type { ConfigProfileStatus } from '@/models/configProfile.model'

// Cùng tên với web (FE_Design); không đưa mã enum ra người dùng

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  FARM_OWNER: 'Chủ nhà yến',
  FARM_TECHNICIAN: 'Kỹ thuật viên',
  DOMAIN_EXPERT: 'Chuyên gia',
}

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  PENDING: 'Chờ kết nối',
  ONLINE: 'Online',
  OFFLINE: 'Mất kết nối',
}

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  OPEN: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang làm',
  VERIFYING: 'Đang kiểm dữ liệu',
  AWAITING_APPROVAL: 'Chờ duyệt',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã huỷ',
}

export const PROFILE_STATUS_LABEL: Record<ConfigProfileStatus, string> = {
  DRAFT: 'Bản nháp',
  APPROVED: 'Đã duyệt',
  ARCHIVED: 'Lưu trữ',
}

// MEDIUM và LOW cùng là "Thường"
export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  CRITICAL: 'Khẩn cấp',
  HIGH: 'Cao',
  MEDIUM: 'Thường',
  LOW: 'Thường',
}

const VN_DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false,
})
export const formatVnDateTime = (at: Date): string => VN_DATE_TIME.format(at)
