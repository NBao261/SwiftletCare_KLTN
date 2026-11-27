// form "Tạo Farm Owner" của Administrator; cùng luật với route POST /admin/farm-owners
export interface FarmOwnerForm {
  email: string
  fullName: string
  phone: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Giới hạn nhập, cùng với backend (Report 3 §4.5)
export const EMAIL_MAX_LENGTH = 254
export const FULL_NAME_MAX_LENGTH = 100
export const PHONE_PATTERN = /^[0-9 ()+-]{8,20}$/

export function validateFarmOwnerForm(form: FarmOwnerForm): Partial<Record<keyof FarmOwnerForm, string>> {
  const errors: Partial<Record<keyof FarmOwnerForm, string>> = {}
  const email = form.email.trim()
  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) errors.email = 'Email không hợp lệ'
  const fullName = form.fullName.trim()
  if (!fullName) errors.fullName = 'Cần nhập họ tên'
  else if (fullName.length > FULL_NAME_MAX_LENGTH) errors.fullName = `Họ tên tối đa ${FULL_NAME_MAX_LENGTH} ký tự`
  const phone = form.phone.trim()
  if (phone && !PHONE_PATTERN.test(phone)) errors.phone = 'Số điện thoại gồm 8–20 ký tự: số, khoảng trắng, + - ( )'
  return errors
}
