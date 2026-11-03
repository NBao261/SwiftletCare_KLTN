// Mã QR của SwiftletCare (Report 4 §5.4, FARM-FR-010/011): nhãn thiết bị và mã tầng dán tại nhà yến
const DEVICE_LABEL_PREFIX = 'swiftletcare://claim'
const ZONE_CODE_PREFIX = 'swiftletcare://zone'

// Nhãn thiết bị: mã thiết bị và mã kích hoạt in trên nhãn
export interface DeviceLabel {
  deviceId: string
  activationKey: string
}

// Đọc phần sau "?" của một mã có tiền tố cho trước; sai tiền tố hoặc mã hoá hỏng thì null
function readQuery(text: string, prefix: string): Map<string, string> | null {
  const trimmed = text.trim()
  if (!trimmed.toLowerCase().startsWith(`${prefix}?`)) return null
  const params = new Map<string, string>()
  for (const part of trimmed.slice(prefix.length + 1).split('&')) {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex <= 0) continue
    try {
      params.set(part.slice(0, separatorIndex), decodeURIComponent(part.slice(separatorIndex + 1)).trim())
    } catch {
      return null
    }
  }
  return params
}

// Nhãn thiết bị `swiftletcare://claim?d=<device ID>&k=<activation key>`; thiếu một trong hai thì null
export function parseDeviceLabel(text: string): DeviceLabel | null {
  const params = readQuery(text, DEVICE_LABEL_PREFIX)
  const deviceId = params?.get('d')
  const activationKey = params?.get('k')
  return deviceId && activationKey ? { deviceId, activationKey } : null
}

// Mã tầng `swiftletcare://zone?z=<zone ID>`; không đúng dạng thì null
export function parseZoneCode(text: string): string | null {
  return readQuery(text, ZONE_CODE_PREFIX)?.get('z') || null
}
