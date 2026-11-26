import { describe, expect, it } from 'vitest'

import { missingMaintenancePhoto } from '@/components/features/farm-owner/work-orders/maintenancePhoto'

const preventive = { kind: 'PREVENTIVE' as const, photo_urls: [] as string[], checklist: [{ photo_url: null }, { photo_url: null }] }

describe('ảnh bằng chứng khi báo xong bảo trì', () => {
  it('phiếu phòng ngừa chưa có ảnh nào thì còn thiếu', () => {
    expect(missingMaintenancePhoto(preventive as never, 0)).toBe(true)
  })

  it('đủ khi có ảnh chọn lần này, ảnh của phiếu hoặc ảnh một mục checklist', () => {
    expect(missingMaintenancePhoto(preventive as never, 1)).toBe(false)
    expect(missingMaintenancePhoto({ ...preventive, photo_urls: ['a'] } as never, 0)).toBe(false)
    expect(missingMaintenancePhoto({ ...preventive, checklist: [{ photo_url: 'b' }, { photo_url: null }] } as never, 0)).toBe(false)
  })

  it('phiếu sửa chữa không bắt buộc ảnh; chưa tải chi tiết thì không chặn', () => {
    expect(missingMaintenancePhoto({ kind: 'REPAIR', photo_urls: [], checklist: [] } as never, 0)).toBe(false)
    expect(missingMaintenancePhoto(undefined, 0)).toBe(false)
  })
})
