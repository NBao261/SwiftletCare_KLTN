import type { AlertStatus, AlertType } from '@/types'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

// BR-08: bật bơm 1–30 phút; tắt bơm, quạt, loa 1 phút – 24 giờ; mặc định 30 phút (ENV-FR-018)
export const OVERRIDE_MIN_MS = MINUTE_MS
export const PUMP_ON_MAX_MS = 30 * MINUTE_MS
export const OVERRIDE_MAX_MS = 24 * HOUR_MS
export const OVERRIDE_DEFAULT_MS = 30 * MINUTE_MS

// Các nút chọn thời lượng trong sheet điều khiển tay — chỉ là lựa chọn giao diện nằm trong khoảng BR-08
export const OVERRIDE_DURATION_OPTIONS_MS: readonly number[] = [
  5 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
  3 * HOUR_MS,
  12 * HOUR_MS,
  24 * HOUR_MS,
]

// ENV-FR-016: đang có các cảnh báo này ở Zone thì bật bơm phải được Farm Owner xác nhận
export const PUMP_ON_CONFIRM_ALERT_TYPES: readonly AlertType[] = ['SENSOR_FAULT', 'RS485_BUS_FAILURE', 'MISTING_INEFFECTIVE']

// "Đang mở" theo Report 3 §6.1: chưa xác nhận hoặc đã xác nhận nhưng chưa tự hết — cả hai đều buộc hỏi lại khi bật bơm
export const PUMP_ON_CONFIRM_ALERT_STATUSES: readonly AlertStatus[] = ['ACTIVE', 'ACKNOWLEDGED']

// TODO(G-06, Kiệt): backend chưa nhận xác nhận cảnh báo trong lệnh bật bơm (api-spec chưa có trường, chưa trả 409).
// Khi POST /devices/sensor-nodes/{id}/relay có trường xác nhận thì đổi thành true — app gửi kèm khi người dùng đã đồng ý
export const HAS_OVERRIDE_CONFIRM_API: boolean = false
