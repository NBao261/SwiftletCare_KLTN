import type { FarmHouseZonePickerValue } from '@/components/features/technician/devices/FarmHouseZonePicker'
import type { DeviceType } from '@/components/features/farm-owner/onboarding/onboardingTypes'

// Trang thiết lập thiết bị; vị trí truyền qua history state, không đưa id lên URL (FE_Design 13.16)
export const DEVICE_SETUP_PATH = '/devices/onboarding'

// Mở từ trang Zone: điền sẵn trang trại, nhà, Zone và bỏ qua bước chọn vị trí
export interface DeviceSetupState {
  location: FarmHouseZonePickerValue
  // Trang đã mở thiết lập; xong thì quay lại đó (mặc định là danh sách thiết bị)
  returnTo?: string
}

export function isDeviceSetupState(state: unknown): state is DeviceSetupState {
  if (typeof state !== 'object' || state === null) return false
  const location = (state as { location?: Partial<FarmHouseZonePickerValue> }).location
  return Boolean(location?.farmId && location.houseId && location.zoneId)
}

// Tiến trình giữ lại khi tải lại trang: chỉ từ lúc thiết bị đã đăng ký. Không lưu mã kích hoạt trên nhãn
export interface SetupProgress {
  // Người đang thiết lập: người khác đăng nhập trong cùng tab không nhận lại tiến trình này
  userId: string
  step: number
  deviceType: DeviceType
  location: Partial<FarmHouseZonePickerValue>
  deviceId: string
  deviceDbId: string
  returnTo?: string
}

const PROGRESS_KEY = 'swiftletcare.deviceSetupProgress'

function isProgress(value: unknown): value is SetupProgress {
  if (typeof value !== 'object' || value === null) return false
  const progress = value as Partial<SetupProgress>
  return typeof progress.userId === 'string' && typeof progress.step === 'number' && Boolean(progress.deviceDbId) && typeof progress.deviceId === 'string'
    && (progress.deviceType === 'SENSOR_NODE' || progress.deviceType === 'CAMERA_NODE') && typeof progress.location === 'object'
}

// sessionStorage có thể bị chặn hoặc hỏng: bỏ qua, trang vẫn chạy
export function saveSetupProgress(progress: SetupProgress, storage: Pick<Storage, 'setItem'> = sessionStorage): void {
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // không lưu được thì chỉ mất việc giữ tiến trình
  }
}

export function loadSetupProgress(userId: string | undefined, storage: Pick<Storage, 'getItem'> = sessionStorage): SetupProgress | undefined {
  try {
    const stored: unknown = JSON.parse(storage.getItem(PROGRESS_KEY) ?? 'null')
    return userId && isProgress(stored) && stored.userId === userId ? stored : undefined
  } catch {
    return undefined
  }
}

export function clearSetupProgress(storage: Pick<Storage, 'removeItem'> = sessionStorage): void {
  try {
    storage.removeItem(PROGRESS_KEY)
  } catch {
    // như trên
  }
}
