// AUTH-FR-005c — đổi mật khẩu tạm; cùng luật với route PUT /auth/password (mật khẩu mới ≥ 8 ký tự, khác mật khẩu cũ)
export const PASSWORD_MIN_LENGTH = 8

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function validatePasswordChange(input: PasswordChangeInput): Partial<Record<keyof PasswordChangeInput, string>> {
  const errors: Partial<Record<keyof PasswordChangeInput, string>> = {}
  if (!input.currentPassword) errors.currentPassword = 'Nhập mật khẩu tạm trong e-mail'
  if (input.newPassword.length < PASSWORD_MIN_LENGTH) errors.newPassword = `Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`
  else if (input.newPassword === input.currentPassword) errors.newPassword = 'Mật khẩu mới phải khác mật khẩu tạm'
  if (input.confirmPassword !== input.newPassword) errors.confirmPassword = 'Hai lần nhập không khớp'
  return errors
}
