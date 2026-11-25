import crypto from 'crypto'

// Mã hoá bí mật lưu trong database (mật khẩu camera) bằng AES-256-GCM: đọc được database vẫn không đọc được mật khẩu
const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'
const IV_BYTES = 12

// Khoá 32 byte ở dạng base64; sai độ dài thì coi như chưa cấu hình
export function secretKeyFrom(value: string | undefined): Buffer | null {
  if (!value) return null
  const key = Buffer.from(value, 'base64')
  return key.length === 32 ? key : null
}

// "v1:<iv>:<tag>:<dữ liệu>" (base64): có phiên bản để sau này đổi thuật toán mà vẫn đọc được bản cũ
export function encryptSecret(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}

// Sai khoá hoặc dữ liệu bị sửa thì GCM báo lỗi: throw, không trả rác
export function decryptSecret(sealed: string, key: Buffer): string {
  const [version, iv, tag, data] = sealed.split(':')
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error('Bí mật đã mã hoá sai định dạng')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}
