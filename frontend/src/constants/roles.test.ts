import { describe, expect, it } from 'vitest'
import { DEVICE_LIST_ROLES, FARM_STRUCTURE_ROLES, canAccessPath, getRoleHomePath } from '@/constants/roles'
import type { Role } from '@/types'

const FO: Role = 'FARM_OWNER'
const DE: Role = 'DOMAIN_EXPERT'
const FT: Role = 'FARM_TECHNICIAN'  // đổi TECHNICIAN → FARM_TECHNICIAN
const ADMIN: Role = 'ADMIN'
const ROLES: Role[] = [FO, DE, FT, ADMIN]

// Ma trận quyền web theo và (backend f9d9522): path → role được vào
const MATRIX: Record<string, Role[]> = {
  '/dashboard': [FO, DE, FT],
  '/dashboard/scada': [FO, FT],          // điều khiển tay: thợ ở nhà được giao (G-33), chuyên gia không
  '/analytics': [FO, DE, FT],
  '/vision': [FO, DE, FT],
  '/health': [FO, DE, FT],
  '/harvests': [FO, DE, FT],
  '/work-orders': [FO, DE, FT],         // Farm Owner thao tác, thợ làm phiếu (G-33), Domain Expert chỉ đọc
  '/maintenance': [FO, DE, FT],
  '/recommendations': [FO, DE, FT],
  '/farms': [FO, DE, FT],
  '/farms/f1/houses/h1/zones/z1': [FO, DE, FT],
  '/devices': [ADMIN, FO, DE, FT],      // ADMIN có nhóm Thiết bị qua /devices
  '/devices/detail': [FO, DE],
  '/devices/onboarding': [FO],          // chỉ FARM_OWNER (FARM_TECHNICIAN/ADMIN gọi API → 403)
  '/ota': [ADMIN],                      // OTA chỉ ADMIN (route /ota ở web là phần của Tuấn)
  '/alerts': [ADMIN, FO, FT],           // ADMIN xem cảnh báo thiết bị mọi farm
  '/system/health': [ADMIN],
  '/system/device-stock': [ADMIN],
  '/system/settings': [ADMIN],
  '/system/audit-log': [ADMIN],
  '/users': [ADMIN],
  '/account-requests': [ADMIN],
  '/domain-expert/queue': [DE],
  // trang quyết định của chuyên gia mở cho Farm Owner (ghi hay chỉ xem do useExpertDecisionRights)
  '/domain-expert/alert-verdicts': [DE, FO],
  '/domain-expert/tuning': [DE, FO],
  '/domain-expert/counting-schedule': [DE, FO],
  '/domain-expert/counting-ring': [DE, FO, FT], // thợ vẽ vòng đếm camera nhà được giao (G-33)
  '/domain-expert/weather-rules': [DE, FO],
  '/domain-expert/reviews': [DE, FO],
  '/domain-expert/reports': [DE],       // Farm Owner xem báo cáo và ngày lệch ở /health
  '/domain-expert/profiles': [DE, FO],
  '/domain-expert/recommendation-rules': [DE, FO],
  '/domain-expert/history': [DE, FO],
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
