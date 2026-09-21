// onboardingTypes.ts — Shared types for Onboarding wizard
// No React imports — pure type definitions
import type { FarmHouseZonePickerValue } from '@/components/common/FarmHouseZonePicker'

export type DeviceType = 'SENSOR_NODE' | 'CAMERA_NODE'

export type OnboardingState = {
  location:   Partial<FarmHouseZonePickerValue>
  deviceType: DeviceType
  deviceId:   string
  secretKey:  string
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
