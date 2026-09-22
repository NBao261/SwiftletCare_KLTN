import type { AdminCreatableRole } from '@/hooks/admin/useUsers'

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
 * dễ đọc/kiểm thử. Thông báo phân biệt "chưa nhập" và "nhập sai", kèm ví dụ để
 * người dùng biết phải sửa thành gì thay vì chỉ báo "không hợp lệ".
 */
export function validateNewUser(form: FormState): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}

  const fullName = form.full_name.trim()
  if (!fullName) errors.full_name = 'Chưa nhập họ tên — nhập tên đầy đủ.'
  else if (fullName.length < 2) errors.full_name = 'Họ tên quá ngắn — cần ít nhất 2 ký tự'

  const email = form.email.trim()
  if (!email) errors.email = 'Chưa nhập email — đây sẽ là tên đăng nhập của tài khoản'
  else if (!EMAIL_RE.test(email)) errors.email = 'Email sai định dạng — cần dạng ten@tenmien.'

  const phone = form.phone.replace(/[\s.-]/g, '')
  if (phone && !PHONE_RE.test(phone)) {
    errors.phone = 'SĐT phải là 10 số bắt đầu bằng 0 (VD: 0912345678) hoặc +84 rồi 9 số (VD: +84912345678)'
  }

  if (!form.password) errors.password = `Chưa nhập mật khẩu — đặt mật khẩu ban đầu ít nhất ${PASSWORD_MIN} ký tự rồi gửi riêng cho nhân viên`
  else if (form.password.length < PASSWORD_MIN) {
    errors.password = `Mật khẩu cần ít nhất ${PASSWORD_MIN} ký tự (đang có ${form.password.length})`
  }

  if (form.role === 'TECHNICIAN' && parseRegions(form.regions).length === 0) {
    errors.regions = 'Chưa có vùng phụ trách — nhập tên khu vực, nhiều vùng cách nhau bằng dấu phẩy.'
  }
  if (form.role === 'SALES_STAFF' && form.farmIds.length === 0) {
    errors.farmIds = 'Chưa chọn farm — tích ít nhất 1 farm trong danh sách để Sales Staff này phụ trách'
  }
  return errors
}
