import type { FarmHouseZonePickerValue } from '@/components/features/technician/devices/FarmHouseZonePicker'

// Trang thiết lập thiết bị; vị trí truyền qua history state, không đưa id lên URL (FE_Design 13.16)
export const DEVICE_SETUP_PATH = '/devices/onboarding'

// Mở từ trang Zone: điền sẵn trang trại, nhà, Zone và bỏ qua bước chọn vị trí
export interface DeviceSetupState {
  location: FarmHouseZonePickerValue
}

export function isDeviceSetupState(state: unknown): state is DeviceSetupState {
  if (typeof state !== 'object' || state === null) return false
  const location = (state as { location?: Partial<FarmHouseZonePickerValue> }).location
  return Boolean(location?.farmId && location.houseId && location.zoneId)
}
