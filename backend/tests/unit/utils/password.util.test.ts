/** AUTH-FR-005c */
import { TEMPORARY_PASSWORD_LENGTH, generateTemporaryPassword } from '@/utils/password.util'

describe('generateTemporaryPassword', () => {
  it('đủ 12 ký tự, không có ký tự dễ nhầm (0, O, 1, l, I), mỗi lần một mật khẩu khác', () => {
    const passwords = Array.from({ length: 50 }, () => generateTemporaryPassword())
    for (const password of passwords) {
      expect(password).toHaveLength(TEMPORARY_PASSWORD_LENGTH)
      expect(password).toMatch(/^[A-Za-z2-9]+$/)
      expect(password).not.toMatch(/[0O1lI]/)
    }
    expect(new Set(passwords).size).toBe(passwords.length)
  })
})
