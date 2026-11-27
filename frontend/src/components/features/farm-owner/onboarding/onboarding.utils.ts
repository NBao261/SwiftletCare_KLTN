// Logic thuần của wizard cài thiết bị: điều kiện xác thực và body đăng ký
import type { RegisterCameraInput, RegisterDeviceInput } from '@/apis/shared/devices.api'
import type { OnboardingState } from '@/components/features/farm-owner/onboarding/onboardingTypes'
import { deviceIdError, isActivationKeyTooLong } from '@/validations/common/deviceId.validation'

// Camera cần nhà, bộ điều khiển cần Zone; cả hai cần mã thiết bị và mã kích hoạt
export function canValidateDevice(data: OnboardingState): boolean {
  const hasCodes = !deviceIdError(data.deviceId) && Boolean(data.secretKey.trim()) && !isActivationKeyTooLong(data.secretKey)
  return data.deviceType === 'CAMERA_NODE'
    ? hasCodes && Boolean(data.location.houseId)
    : hasCodes && Boolean(data.location.zoneId)
}

// Body POST /devices/camera-nodes/register
export function cameraRegisterInput(data: OnboardingState): RegisterCameraInput {
  return { device_id: data.deviceId.trim(), house_id: data.location.houseId ?? '', secret_key: data.secretKey.trim() }
}

// Body POST /devices/sensor-nodes/register
export function sensorRegisterInput(data: OnboardingState): RegisterDeviceInput {
  return { device_id: data.deviceId.trim(), zone_id: data.location.zoneId ?? '', secret_key: data.secretKey.trim() }
}
