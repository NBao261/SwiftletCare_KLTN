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

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

// Giờ dạng HH:MM 24 giờ, như quiet_hours của backend ("22:00", "06:00")
export function isValidClockTime(value: string): boolean {
  return CLOCK_TIME_PATTERN.test(value.trim())
}
