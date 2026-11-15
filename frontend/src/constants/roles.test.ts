import { describe, expect, it } from 'vitest'
import { DEVICE_LIST_ROLES, FARM_STRUCTURE_ROLES, canAccessPath, getRoleHomePath } from '@/constants/roles'
import type { Role } from '@/types'

const FO: Role = 'FARM_OWNER'
const DE: Role = 'DOMAIN_EXPERT'
const FT: Role = 'FARM_TECHNICIAN'  // G-20: đổi TECHNICIAN → FARM_TECHNICIAN
const ADMIN: Role = 'ADMIN'
const ROLES: Role[] = [FO, DE, FT, ADMIN]

// Ma trận quyền web theo Report 3 §2.4 và G-20 (backend f9d9522): path → role được vào
const MATRIX: Record<string, Role[]> = {
  '/dashboard': [FO, DE],
  '/dashboard/scada': [FO],
  '/analytics': [FO, DE],
  '/vision': [FO, DE],
  '/health': [FO, DE],
  '/harvests': [FO, DE],
  '/work-orders': [FO, DE],             // G-21: Farm Owner thao tác, Domain Expert chỉ đọc (Report 3 §2.4)
  '/farms': [FO, DE, FT],
  '/farms/f1/houses/h1/zones/z1': [FO, DE, FT],
  '/devices': [ADMIN, FO, DE, FT],      // G-20: ADMIN có Console thiết bị qua /devices
  '/devices/detail': [FO, DE],
  '/onboarding': [FO],                  // G-20: chỉ FARM_OWNER (FARM_TECHNICIAN/ADMIN gọi API → 403)
  '/ota': [ADMIN],                      // G-20: OTA chỉ ADMIN (route /ota ở web là phần của Tuấn)
  '/alerts': [ADMIN, FO, FT],           // G-20: ADMIN xem cảnh báo thiết bị mọi farm
  '/system/health': [ADMIN],
  '/system/devices': [ADMIN],
  '/system/device-stock': [ADMIN],
  '/system/settings': [ADMIN],
  '/system/audit-log': [ADMIN],
  '/users': [ADMIN],
  '/account-requests': [ADMIN],
  '/domain-expert/queue': [DE],
  '/settings': ROLES,
}

describe('nhóm role của route (RequireRole)', () => {
  it('trang farm, nhà, Zone không có Admin (số liệu môi trường); /devices có Admin', () => {
    expect(FARM_STRUCTURE_ROLES).not.toContain(ADMIN)
    expect(DEVICE_LIST_ROLES).toEqual(expect.arrayContaining([ADMIN, FO, DE, FT]))
  })
})

describe('canAccessPath — ma trận quyền web (G-20)', () => {
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
