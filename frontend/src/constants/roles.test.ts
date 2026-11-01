import { describe, expect, it } from 'vitest'
import { canAccessPath, getRoleHomePath } from '@/constants/roles'
import type { Role } from '@/types'

const FO: Role = 'FARM_OWNER'
const DE: Role = 'DOMAIN_EXPERT'
const TECH: Role = 'TECHNICIAN'
const ADMIN: Role = 'ADMIN'
const ROLES: Role[] = [FO, DE, TECH, ADMIN]

// Ma trận quyền web theo Report 3 §2.4 và todo-review2.md G-15: path → role được vào
const MATRIX: Record<string, Role[]> = {
  '/dashboard': [FO, DE],
  '/dashboard/scada': [FO],
  '/analytics': [FO, DE],
  '/vision': [FO, DE],
  '/stream/abc': [FO, DE],
  '/harvests': [FO, DE],
  '/farms': [FO, DE, TECH],
  '/farms/f1/houses/h1/zones/z1': [FO, DE, TECH],
  '/devices': [FO, DE, TECH],
  '/devices/detail': [FO, DE],
  '/onboarding': [FO, TECH],
  '/ota': [TECH],
  '/alerts': [FO, TECH],
  '/system/health': [ADMIN],
  '/system/devices': [ADMIN],
  '/system/settings': [ADMIN],
  '/system/audit-log': [ADMIN],
  '/users': [ADMIN],
  '/account-requests': [ADMIN],
  '/domain-expert/queue': [DE],
  '/settings': ROLES,
}

describe('canAccessPath — ma trận quyền web (G-15)', () => {
  for (const [path, allowed] of Object.entries(MATRIX)) {
    for (const role of ROLES) {
      const expected = allowed.includes(role)
      it(`${role} ${expected ? 'vào được' : 'bị chặn ở'} ${path}`, () => {
        expect(canAccessPath(role, path)).toBe(expected)
      })
    }
  }

  it('chưa đăng nhập thì bị chặn ở path có giới hạn role', () => {
    expect(canAccessPath(undefined, '/dashboard')).toBe(false)
  })

  it('trang nhà của mỗi role nằm trong quyền của role đó', () => {
    for (const role of ROLES) expect(canAccessPath(role, getRoleHomePath(role))).toBe(true)
  })
})
