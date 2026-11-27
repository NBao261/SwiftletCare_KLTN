// đổi mật khẩu tạm; cùng luật với route PUT /auth/password (mật khẩu mới ≥ 8 ký tự, khác mật khẩu cũ)
export const PASSWORD_MIN_LENGTH = 8
// Giới hạn của bcrypt phía backend: dài hơn thì bị cắt lặng lẽ
export const PASSWORD_MAX_LENGTH = 72
// Mã đặt lại gửi qua e-mail: đúng 6 chữ số
export const RESET_CODE_PATTERN = /^\d{6}$/

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

// Mật khẩu mới + nhập lại, dùng chung cho đổi, đặt lại và tạo tài khoản từ lời mời
export function validateNewPassword(newPassword: string, confirmPassword: string): { newPassword?: string; confirmPassword?: string } {
  const errors: { newPassword?: string; confirmPassword?: string } = {}
  if (newPassword.length < PASSWORD_MIN_LENGTH) errors.newPassword = `Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`
  else if (newPassword.length > PASSWORD_MAX_LENGTH) errors.newPassword = `Tối đa ${PASSWORD_MAX_LENGTH} ký tự`
  if (confirmPassword !== newPassword) errors.confirmPassword = 'Hai lần nhập không khớp'
  return errors
}

export interface PasswordResetInput {
  code: string
  newPassword: string
  confirmPassword: string
}

export function validatePasswordReset(input: PasswordResetInput): Partial<Record<keyof PasswordResetInput, string>> {
  const errors: Partial<Record<keyof PasswordResetInput, string>> = {}
  if (!RESET_CODE_PATTERN.test(input.code.trim())) errors.code = 'Mã gồm đúng 6 chữ số'
  const { newPassword, confirmPassword } = validateNewPassword(input.newPassword, input.confirmPassword)
  if (newPassword) errors.newPassword = newPassword
  if (confirmPassword) errors.confirmPassword = confirmPassword
  return errors
}

export function validatePasswordChange(input: PasswordChangeInput): Partial<Record<keyof PasswordChangeInput, string>> {
  const errors: Partial<Record<keyof PasswordChangeInput, string>> = {}
  if (!input.currentPassword) errors.currentPassword = 'Nhập mật khẩu tạm trong e-mail'
  const { newPassword, confirmPassword } = validateNewPassword(input.newPassword, input.confirmPassword)
  if (newPassword) errors.newPassword = newPassword
  else if (input.newPassword === input.currentPassword) errors.newPassword = 'Mật khẩu mới phải khác mật khẩu tạm'
  if (confirmPassword) errors.confirmPassword = confirmPassword
  return errors
}
