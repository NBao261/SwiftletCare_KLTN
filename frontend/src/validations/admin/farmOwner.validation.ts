// AUTH-FR-005c — form "Tạo Farm Owner" của Administrator; cùng luật với route POST /admin/farm-owners
export interface FarmOwnerForm {
  email: string
  fullName: string
  phone: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateFarmOwnerForm(form: FarmOwnerForm): Partial<Record<keyof FarmOwnerForm, string>> {
  const errors: Partial<Record<keyof FarmOwnerForm, string>> = {}
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Email không hợp lệ'
  if (!form.fullName.trim()) errors.fullName = 'Cần nhập họ tên'
  return errors
}
