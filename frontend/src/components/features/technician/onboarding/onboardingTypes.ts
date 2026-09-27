// onboardingTypes.ts — Shared types for Onboarding wizard
// No React imports — pure type definitions
import type { FarmHouseZonePickerValue } from '@/components/features/technician/devices/FarmHouseZonePicker'

export type DeviceType = 'SENSOR_NODE' | 'CAMERA_NODE'

export type OnboardingState = {
  location:   Partial<FarmHouseZonePickerValue>
  deviceType: DeviceType
  deviceId:   string
  // TODO [BE-GAP]: thêm lại secretKey khi registerSensorNode nhận param này từ backend.
  // Hiện tại: endpoint chỉ nhận { device_id, zone_id } — không xác thực secret_key,
  // giữ field này trong UI — chỉ block submit — không gửi lên backend — tạo cảm giác
  // bảo mật ảo. Bỏ hẳn để không gây hiểu lầm.
  /** _id của SensorNode trong DB sau khi registerSensorNode thành công (Step2) */
  deviceDbId: string
  /** _id của Ticket liên kết với lắp đặt này — đọc từ URL query ?ticketId=...
   *  Dùng ở Step6 để gọi updateSatChecklist. Undefined nếu onboard không từ ticket. */
  ticketId:   string | undefined
  ssid:       string  // WiFi farm SSID
  wifiPass:   string
}

export type StepProps = {
  data: OnboardingState
  patch: (partial: Partial<OnboardingState>) => void
  onNext: () => void
  onBack: () => void
}
