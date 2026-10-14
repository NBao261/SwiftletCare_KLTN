import type { AdminCreatableRole } from '@/hooks/admin/useUsers'
import { t } from '@/i18n'

/** Khớp validator backend admin.route.ts: isEmail / isLength({min:8}) / notEmpty / isArray({min:1}) */
export const PASSWORD_MIN = 8
// Không đưa mật khẩu mẫu cụ thể vào placeholder/thông báo: Admin sẽ copy dùng luôn
// → nhiều tài khoản chung một mật khẩu đoán được (và bị GitGuardian quét là secret).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** SĐT Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx (bỏ khoảng trắng/chấm/gạch trước khi kiểm) */
const PHONE_RE = /^(0|\+84)\d{9}$/

export interface FormState {
  role: AdminCreatableRole
  full_name: string
  email: string
  phone: string
  password: string
  regions: string
  farmIds: string[]
}

export type Field = Exclude<keyof FormState, 'role'>

export function parseRegions(raw: string): string[] {
  return raw.split(',').map(r => r.trim()).filter(Boolean)
}

/**
 * Trả về map lỗi theo field — rỗng nghĩa là form hợp lệ. Tách khỏi component để
 * dễ đọc/kiểm thử. Thông báo phân biệt "chưa nhập" và "nhập sai", kèm ví dụ khi cần.
 * Thông báo nên ngắn: CreateUserModal hiện lỗi cùng hàng với nhãn ô (errorInLabel, 1 dòng
 * cắt "…") để popup canh giữa không đổi chiều cao — lỗi dài sẽ bị cắt.
 */
export function validateNewUser(form: FormState): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}

  const fullName = form.full_name.trim()
  if (!fullName) errors.full_name = 'Hãy nhập họ tên'
  else if (fullName.length < 2) errors.full_name = 'Họ tên cần ít nhất 2 ký tự'

  const email = form.email.trim()
  if (!email) errors.email = 'Hãy nhập email (dùng làm tên đăng nhập)'
  else if (!EMAIL_RE.test(email)) errors.email = 'Email sai định dạng, VD: ten@tenmien.vn'

  const phone = form.phone.replace(/[\s.-]/g, '')
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'SĐT cần dạng 0912345678 hoặc +84912345678'

  // Câu có số dịch tại đây (t + biến); câu cố định để Input tự dịch khi hiển thị
  if (!form.password) errors.password = t('Hãy nhập mật khẩu (ít nhất {{min}} ký tự)', { min: PASSWORD_MIN })
  else if (form.password.length < PASSWORD_MIN) {
    errors.password = t('Mật khẩu cần ít nhất {{min}} ký tự (đang có {{count}})', { min: PASSWORD_MIN, count: form.password.length })
  }

  if (form.role === 'TECHNICIAN' && parseRegions(form.regions).length === 0) {
    errors.regions = 'Hãy nhập ít nhất 1 vùng phụ trách'
  }
  if (form.role === 'SALES_STAFF' && form.farmIds.length === 0) {
    errors.farmIds = t('Hãy chọn ít nhất 1 farm phụ trách')
  }
  return errors
}
