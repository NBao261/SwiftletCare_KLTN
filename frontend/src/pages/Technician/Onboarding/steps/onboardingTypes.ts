// onboardingTypes.ts — Shared types for Onboarding wizard
// No React imports — pure type definitions
import type { FarmHouseZonePickerValue } from '@/components/common/FarmHouseZonePicker'

export type DeviceType = 'SENSOR_NODE' | 'CAMERA_NODE'

export type OnboardingState = {
  location:   Partial<FarmHouseZonePickerValue>
  deviceType: DeviceType
  deviceId:   string
  secretKey:  string
  deviceDbId: string  // _id sau khi register thành công
  ssid:       string  // WiFi farm SSID
  wifiPass:   string
}

export type StepProps = {
  data: OnboardingState
  patch: (partial: Partial<OnboardingState>) => void
  onNext: () => void
  onBack: () => void
}
