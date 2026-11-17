import crypto from 'crypto'

/** Report 3 §4.5 — mật khẩu tạm của tài khoản do Administrator tạo: 12 ký tự ngẫu nhiên (AUTH-FR-005c) */
export const TEMPORARY_PASSWORD_LENGTH = 12

// Bỏ các ký tự dễ đọc nhầm khi chép tay từ thư (0/O, 1/l/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** Sinh mật khẩu tạm bằng bộ sinh số ngẫu nhiên an toàn (crypto), không dùng Math.random */
export function generateTemporaryPassword(length = TEMPORARY_PASSWORD_LENGTH): string {
  let password = ''
  for (let i = 0; i < length; i++) password += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return password
}
