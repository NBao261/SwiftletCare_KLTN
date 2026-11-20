import { translated } from '@/i18n'

/**
 * SYSTEM-FR-001 — nhãn tiếng Việt (translated(): đọc ra theo VI/EN) cho mã `action` trong `audit_logs`. Mã phải
 * khớp NGUYÊN VĂN chuỗi backend truyền vào `logAction()` (grep "logAction(" trong
 * backend/src/services + jobs) — không phải enum, backend ghi string tự do nên
 * mã lạ vẫn có thể xuất hiện; UI hiện thẳng mã đó khi không có nhãn.
 * Dùng chung cho dropdown lọc + danh sách AdminAuditLogPage.
 */
export const AUDIT_ACTION_LABEL: Record<string, string> = translated({
  // ── Tài khoản (admin.service.ts / auth.service.ts) ─────────────────────────
  ACCOUNT_LOCKED: 'Khoá tài khoản',
  ACCOUNT_UNLOCKED: 'Mở khoá tài khoản',
  ACCOUNT_DELETED: 'Hoàn tất xoá tài khoản',
  DELETION_REQUESTED: 'Yêu cầu xoá tài khoản',
  DELETION_CANCELLED: 'Huỷ yêu cầu xoá tài khoản',
  DELETION_REJECTED: 'Từ chối yêu cầu xoá tài khoản',
  FARM_OWNER_CREATED: 'Tạo tài khoản chủ nhà yến',
  ACCOUNT_CREATED_FROM_INVITATION: 'Tạo tài khoản từ lời mời',
  // Bản ghi cũ, backend không còn ghi mã này
  USER_CREATED: 'Tạo tài khoản nhân viên',
  PASSWORD_RESET: 'Đặt lại mật khẩu',
  PASSWORD_CHANGED: 'Đổi mật khẩu',
  LOGIN: 'Đăng nhập',
  LOGIN_FAILED: 'Đăng nhập thất bại',

  // ── Farm / thiết bị / ngưỡng (farm, device, zone service) ──────────────────
  FARM_OWNERSHIP_TRANSFERRED: 'Chuyển quyền sở hữu trang trại',
  FARM_SOFT_DELETED: 'Xoá mềm trang trại',
  DEVICE_REGISTERED: 'Đăng ký thiết bị',
  DEVICE_REASSIGNED: 'Chuyển thiết bị sang Zone khác',
  THRESHOLD_UPDATED: 'Cập nhật ngưỡng Zone',
  FUZZY_TUNING_UPDATED: 'Chỉnh hệ số mờ',
  RELAY_OVERRIDE: 'Điều khiển tay',
  RELAY_OVERRIDE_CLEARED: 'Trả rơ-le về tự động',
  SPEAKER_SCHEDULE_UPDATED: 'Cập nhật lịch loa ru',
  AUDIO_TRACK_UPLOADED: 'Upload file loa ru',
  AUDIO_TRACK_SYNC_UPDATED: 'Đánh dấu chép file loa ru vào thẻ SD',
  AUDIO_TRACK_SELECTED: 'Chọn bài loa ru mặc định',
  AUDIO_TRACK_DELETED: 'Xoá file loa ru',

  // ── Cấu hình hệ thống (system.service.ts) ──────────────────────────────────
  DEFAULT_THRESHOLDS_UPDATED: 'Cập nhật ngưỡng mặc định hệ thống',
})

/**
 * Trang Nhật ký hệ thống + card "Nhật ký hoạt động gần đây" chỉ hiện nhật ký TÀI KHOẢN (target_type='user',
 * lọc ở server) — không hiện log thiết bị/cấu hình. Đây là các mã backend ghi với target_type 'user'
 * (auth.service.ts, admin.service.ts) — dùng cho dropdown lọc hành động.
 */
export const AUDIT_TARGET_TYPE = 'user'
export const USER_AUDIT_ACTIONS = [
  'LOGIN', 'LOGIN_FAILED', 'PASSWORD_RESET', 'PASSWORD_CHANGED',
  'FARM_OWNER_CREATED', 'ACCOUNT_CREATED_FROM_INVITATION',
  'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
  'DELETION_REQUESTED', 'DELETION_CANCELLED', 'DELETION_REJECTED', 'ACCOUNT_DELETED',
] as const

/** Nhãn cho `target_type` (chuỗi backend, snake_case) — thiếu thì hiện nguyên mã */
export const AUDIT_TARGET_LABEL: Record<string, string> = translated({
  user: 'Người dùng',
  farm: 'Trang trại',
  zone: 'Zone',
  sensor_node: 'Bộ điều khiển',
  camera_node: 'Camera đếm chim',
  system_settings: 'Cấu hình hệ thống',
})
