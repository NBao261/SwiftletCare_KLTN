import { describe, expect, it } from 'vitest'

import { canManageLullabyTracks, canRestartController } from '@/components/features/farm-owner/devices/deviceActions'

describe('nút thao tác thiết bị của Farm Owner (todo-audit-1118 W-04, W-12)', () => {
  it('chỉ Farm Owner quản lý bài loa ru (ENV-FR-013c)', () => {
    expect(canManageLullabyTracks('FARM_OWNER')).toBe(true)
    for (const role of ['DOMAIN_EXPERT', 'FARM_TECHNICIAN', 'ADMIN'] as const) expect(canManageLullabyTracks(role)).toBe(false)
  })

  it('Farm Owner restart bộ điều khiển đang ONLINE; camera, thiết bị offline và role khác thì không (FARM-FR-013)', () => {
    expect(canRestartController('FARM_OWNER', { type: 'sensor', status: 'ONLINE' })).toBe(true)
    expect(canRestartController('FARM_OWNER', { type: 'sensor', status: 'OFFLINE' })).toBe(false)
    expect(canRestartController('FARM_OWNER', { type: 'camera', status: 'ONLINE' })).toBe(false)
    expect(canRestartController('DOMAIN_EXPERT', { type: 'sensor', status: 'ONLINE' })).toBe(false)
  })
})
