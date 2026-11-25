import crypto from 'crypto'
import { decryptSecret, encryptSecret, secretKeyFrom } from '@/utils/secretBox.util'

describe('secretBox — mã hoá mật khẩu camera', () => {
  const key = crypto.randomBytes(32)

  it('mã hoá rồi giải mã ra đúng chuỗi, mỗi lần một bản mã khác', () => {
    const first = encryptSecret('P@ss:w/rd ơi', key)
    const second = encryptSecret('P@ss:w/rd ơi', key)
    expect(first).not.toBe(second)
    expect(first).not.toContain('P@ss')
    expect(decryptSecret(first, key)).toBe('P@ss:w/rd ơi')
  })

  it('sai khoá hoặc bản mã bị sửa thì báo lỗi, không trả rác', () => {
    const sealed = encryptSecret('secret', key)
    expect(() => decryptSecret(sealed, crypto.randomBytes(32))).toThrow()
    const parts = sealed.split(':')
    parts[3] = Buffer.from('tampered').toString('base64')
    expect(() => decryptSecret(parts.join(':'), key)).toThrow()
    expect(() => decryptSecret('khong-dung-dinh-dang', key)).toThrow()
  })

  it('khoá phải đúng 32 byte base64', () => {
    expect(secretKeyFrom(key.toString('base64'))).toEqual(key)
    expect(secretKeyFrom(crypto.randomBytes(16).toString('base64'))).toBeNull()
    expect(secretKeyFrom(undefined)).toBeNull()
    expect(secretKeyFrom('')).toBeNull()
  })
})
