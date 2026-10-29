const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Độ dài tối thiểu của mật khẩu — đúng luật backend (auth.route.ts, minLength 8 trong api-spec)
export const PASSWORD_MIN_LENGTH = 8

// Email đúng dạng
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

// Mật khẩu đủ độ dài backend yêu cầu
export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH
}
