// Mã thiết bị in trên nhãn: cùng mẫu và độ dài với backend (device ID là username và một đoạn topic trên broker)
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]+$/
export const DEVICE_ID_MAX_LENGTH = 40
export const ACTIVATION_KEY_MAX_LENGTH = 128

// Lỗi của mã thiết bị đã bỏ khoảng trắng hai đầu; undefined = hợp lệ (trống cũng báo, nơi gọi tự quyết lúc nào hiện)
export function deviceIdError(raw: string): string | undefined {
  const id = raw.trim()
  if (!id) return 'Chưa nhập mã thiết bị'
  if (id.length > DEVICE_ID_MAX_LENGTH) return `Mã thiết bị tối đa ${DEVICE_ID_MAX_LENGTH} ký tự`
  if (!DEVICE_ID_PATTERN.test(id)) return 'Mã thiết bị chỉ gồm chữ, số, dấu _ và -'
  return undefined
}

export const isActivationKeyTooLong = (raw: string): boolean => raw.trim().length > ACTIVATION_KEY_MAX_LENGTH
