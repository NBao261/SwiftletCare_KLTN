// Lý do đăng ký thiết bị thất bại, nói đúng theo mã lỗi của backend (error.code); mã lạ thì theo mã HTTP
export type FailureTone = 'warning' | 'error' | 'neutral'

export interface RegistrationFailure {
  tone: FailureTone
  title: string
  // Việc cần làm tiếp
  detail: string
}

interface ErrorShape {
  response?: { status?: number; data?: { error?: { code?: string } } }
}

const BY_CODE: Record<string, RegistrationFailure> = {
  INVALID_DEVICE_LABEL: {
    tone: 'error',
    title: 'Mã thiết bị hoặc mã kích hoạt không đúng',
    detail: 'Kiểm tra lại cả hai mã trên nhãn dán mặt sau thiết bị. Mã kích hoạt không phân biệt chữ hoa, chữ thường.',
  },
  DEVICE_REVOKED: {
    tone: 'error',
    title: 'Thiết bị này đã bị thu hồi',
    detail: 'Quản trị viên đã thu hồi thiết bị nên không kích hoạt được. Liên hệ Quản trị viên.',
  },
  DEVICE_ALREADY_REGISTERED: {
    tone: 'warning',
    title: 'Thiết bị đã được đăng ký trong trang trại này',
    detail: 'Tìm nó ở trang Thiết bị. Muốn đưa sang vị trí khác, dời thiết bị ở đó; muốn đăng ký lại, gỡ thiết bị trước.',
  },
  DEVICE_IN_OTHER_FARM: {
    tone: 'warning',
    title: 'Thiết bị đang thuộc một trang trại khác',
    detail: 'Liên hệ Quản trị viên để gỡ thiết bị khỏi trang trại đó rồi đăng ký lại.',
  },
  SETUP_LOCATION_NOT_ALLOWED: {
    tone: 'error',
    title: 'Bạn không thiết lập được thiết bị ở vị trí này',
    detail: 'Tài khoản chỉ thiết lập thiết bị ở trang trại của mình, và kỹ thuật viên chỉ ở nhà được giao. Quay lại bước 1 chọn vị trí khác.',
  },
}

const NETWORK: RegistrationFailure = {
  tone: 'neutral',
  title: 'Không kết nối được máy chủ',
  detail: 'Kiểm tra mạng của bạn rồi thử lại. Thiết bị chưa được đăng ký.',
}

const SERVER: RegistrationFailure = {
  tone: 'neutral',
  title: 'Máy chủ đang gặp sự cố',
  detail: 'Thiết bị chưa được đăng ký. Thử lại sau ít phút, nếu vẫn lỗi thì báo Quản trị viên.',
}

const UNKNOWN: RegistrationFailure = {
  tone: 'neutral',
  title: 'Chưa đăng ký được thiết bị',
  detail: 'Hệ thống không cho biết lý do cụ thể. Kiểm tra lại các thông tin đã nhập rồi thử lại.',
}

export function describeRegistrationFailure(err: unknown): RegistrationFailure {
  const { response } = (err ?? {}) as ErrorShape
  if (!response) return NETWORK
  const known = BY_CODE[response.data?.error?.code ?? '']
  if (known) return known
  if (response.status !== undefined && response.status >= 500) return SERVER
  return UNKNOWN
}
