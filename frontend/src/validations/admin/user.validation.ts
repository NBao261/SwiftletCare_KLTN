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
 * Thông báo ngắn gọn (vài chữ): CreateUserModal hiện lỗi ngay dưới ô nhập.
 */
export function validateNewUser(form: FormState): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}

  const fullName = form.full_name.trim()
  if (!fullName) errors.full_name = 'Chưa nhập họ tên'
  else if (fullName.length < 2) errors.full_name = 'Tối thiểu 2 ký tự'

  const email = form.email.trim()
  if (!email) errors.email = 'Chưa nhập email'
  else if (!EMAIL_RE.test(email)) errors.email = 'Email không hợp lệ'

  const phone = form.phone.replace(/[\s.-]/g, '')
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Số điện thoại không hợp lệ'

  // Câu có số dịch tại đây (t + biến); câu cố định để Input tự dịch khi hiển thị
  if (!form.password) errors.password = 'Chưa nhập mật khẩu'
  else if (form.password.length < PASSWORD_MIN) {
    errors.password = t('Tối thiểu {{min}} ký tự', { min: PASSWORD_MIN })
  }

  if (form.role === 'TECHNICIAN' && parseRegions(form.regions).length === 0) {
    errors.regions = 'Chưa nhập vùng phụ trách'
  }
  if (form.role === 'SALES_STAFF' && form.farmIds.length === 0) {
    errors.farmIds = t('Chưa chọn farm')
  }
  return errors
}
