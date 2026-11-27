import { describe, expect, it } from 'vitest'
import { devicesToCheck } from '@/components/features/admin/dashboard/AttentionDevicesCard'
import type { SystemNodeStatusItem } from '@/types'

const node = (id: string, patch: Partial<SystemNodeStatusItem>): SystemNodeStatusItem => ({
  _id: id, device_id: id, type: 'sensor', status: 'ONLINE', zone_id: 'z', farm_id: 'f', farm_name: 'F', house_name: 'H', zone_name: 'Z', ...patch,
})

describe('thiết bị cần chú ý của quản trị viên', () => {
  it('bỏ thiết bị đang online, mất kết nối trước chờ kết nối, mới mất tín hiệu trước', () => {
    const nodes = [
      node('on', {}),
      node('wait', { status: 'PENDING' }),
      node('off-old', { status: 'OFFLINE', last_heartbeat: '2026-11-01T00:00:00Z' }),
      node('off-new', { status: 'OFFLINE', last_heartbeat: '2026-11-26T00:00:00Z' }),
    ]
    expect(devicesToCheck(nodes).map(item => item._id)).toEqual(['off-new', 'off-old', 'wait'])
  })

  it('tất cả online thì không có thiết bị nào cần chú ý', () => {
    expect(devicesToCheck([node('a', {}), node('b', {})])).toEqual([])
  })
})
