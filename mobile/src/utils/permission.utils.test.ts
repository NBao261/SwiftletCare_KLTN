import { describe, expect, it } from '@jest/globals'
import type { Role, User } from '@/types'
import { canPerform } from '@/utils/permission.utils'

// Tài khoản mẫu chỉ khác nhau ở role
function buildUser(role: Role): User {
  return {
    _id: 'user-1',
    email: 'user@swiftletcare.dev',
    full_name: 'Nguyễn Vũ Len',
    role,
    is_active: true,
    notification_preferences: { push: true, telegram: false, quiet_hours: { start: '22:00', end: '06:00' } },
    created_at: '2026-10-30T00:00:00.000Z',
  }
}

describe('canPerform', () => {
  it('chỉ Farm Owner được thiết lập thiết bị bằng QR (MF-10)', () => {
    expect(canPerform(buildUser('FARM_OWNER'), 'setupDevice')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'setupDevice')).toBe(false)
  })

  it('chỉ Farm Owner được trả relay về tự động; chuyên gia chỉ xem', () => {
    expect(canPerform(buildUser('FARM_OWNER'), 'clearRelayOverride')).toBe(true)
    expect(canPerform(buildUser('DOMAIN_EXPERT'), 'clearRelayOverride')).toBe(false)
  })

  it('chỉ Farm Owner tạo trang trại, nhà yến và đăng ký camera', () => {
    for (const action of ['createFarm', 'createHouse', 'registerCamera'] as const) {
      expect(canPerform(buildUser('FARM_OWNER'), action)).toBe(true)
      expect(canPerform(buildUser('DOMAIN_EXPERT'), action)).toBe(false)
    }
  })

  it('chưa đăng nhập thì không được thao tác nào', () => {
    expect(canPerform(null, 'setupDevice')).toBe(false)
  })
})
