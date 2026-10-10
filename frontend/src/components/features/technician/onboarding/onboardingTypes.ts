// onboardingTypes.ts — Shared types for Onboarding wizard
// No React imports — pure type definitions
import type { FarmHouseZonePickerValue } from '@/components/features/technician/devices/FarmHouseZonePicker'

export type DeviceType = 'SENSOR_NODE' | 'CAMERA_NODE'

export type OnboardingState = {
  location:   Partial<FarmHouseZonePickerValue>
  deviceType: DeviceType
  deviceId:   string
  /** secretKey in trên nhãn thiết bị — BE xác thực cặp {device_id, secret_key} (Flow 1 bước 3–4) */
  secretKey:  string
  /** _id của SensorNode/CameraNode trong DB sau khi đăng ký thành công (Step2) */
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
