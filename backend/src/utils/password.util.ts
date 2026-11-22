import crypto from 'crypto'

/** Report 3 §4.5 */
export const TEMPORARY_PASSWORD_LENGTH = 12

// Bỏ ký tự dễ đọc nhầm (0/O, 1/l/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** crypto, không dùng Math.random */
export function generateTemporaryPassword(length = TEMPORARY_PASSWORD_LENGTH): string {
  let password = ''
  for (let i = 0; i < length; i++) password += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return password
}
