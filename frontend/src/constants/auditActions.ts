/**
 * SYSTEM-FR-001 — nhãn tiếng Việt cho mã `action` trong `audit_logs`. Mã phải
 * khớp NGUYÊN VĂN chuỗi backend truyền vào `logAction()` (grep "logAction(" trong
 * backend/src/services + jobs) — không phải enum, backend ghi string tự do nên
 * mã lạ vẫn có thể xuất hiện; UI hiện thẳng mã đó khi không có nhãn.
 * Dùng chung cho dropdown lọc + danh sách AuditLogPage.
 */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  // ── Tài khoản (admin.service.ts / auth.service.ts) ─────────────────────────
  ACCOUNT_LOCKED: 'Khoá tài khoản',
  ACCOUNT_UNLOCKED: 'Mở khoá tài khoản',
  ACCOUNT_DELETED: 'Hoàn tất xoá tài khoản',
  DELETION_REQUESTED: 'Yêu cầu xoá tài khoản',
  USER_CREATED: 'Tạo tài khoản nhân viên',
  TECHNICIAN_REGIONS_UPDATED: 'Cập nhật vùng phụ trách Technician',
  SALES_STAFF_UNASSIGNED: 'Gỡ Sales Staff khỏi farm',
  SALES_STAFF_REQUEST_APPROVED: 'Duyệt đề xuất Sales Staff',
  SALES_STAFF_REQUEST_REJECTED: 'Từ chối đề xuất Sales Staff',
  PASSWORD_RESET: 'Đặt lại mật khẩu',
  LOGIN: 'Đăng nhập',
  LOGIN_FAILED: 'Đăng nhập thất bại',

  // ── Farm / thiết bị / ngưỡng (farm, device, zone service) ──────────────────
  FARM_OWNERSHIP_TRANSFERRED: 'Chuyển quyền sở hữu farm',
  FARM_SOFT_DELETED: 'Xoá mềm farm',
  DEVICE_REGISTERED: 'Đăng ký thiết bị',
  DEVICE_REASSIGNED: 'Chuyển thiết bị sang zone khác',
  THRESHOLD_UPDATED: 'Cập nhật ngưỡng zone',
  RELAY_OVERRIDE: 'Điều khiển relay thủ công',

  // ── Ticket (ticket.service.ts / alertEscalation.job.ts) ────────────────────
  TICKET_ADMIN_OVERRIDE: 'Admin can thiệp ticket',
  TICKET_SLA_BREACHED: 'Ticket vi phạm SLA',

  // ── Cấu hình hệ thống (system.service.ts) ──────────────────────────────────
  DEFAULT_THRESHOLDS_UPDATED: 'Cập nhật ngưỡng mặc định hệ thống',
  SLA_UPDATED: 'Cập nhật SLA ticket',
}

/** Nhãn cho `target_type` (chuỗi backend, snake_case) — thiếu thì hiện nguyên mã */
export const AUDIT_TARGET_LABEL: Record<string, string> = {
  user: 'Người dùng',
  farm: 'Farm',
  zone: 'Zone',
  sensor_node: 'Sensor node',
  camera_node: 'Camera node',
  ticket: 'Ticket',
  system_settings: 'Cấu hình hệ thống',
  sales_assignment: 'Gán Sales Staff',
  sales_assignment_request: 'Đề xuất Sales Staff',
}
