import { describe, expect, it } from 'vitest'
import { countByStatus, nodePlace, sortDevices } from '@/components/features/admin/devices/deviceList.utils'
import type { SystemNodeStatusItem } from '@/types'

const node = (id: string, patch: Partial<SystemNodeStatusItem>): SystemNodeStatusItem => ({
  _id: id, device_id: id, type: 'sensor', status: 'ONLINE', zone_id: 'z', farm_id: 'f', farm_name: 'F', house_name: 'H', zone_name: 'Z', ...patch,
})

describe('danh sách thiết bị của quản trị viên', () => {
  const nodes = [
    node('on-old', { last_heartbeat: '2026-11-27T08:00:00Z' }),
    node('on-new', { last_heartbeat: '2026-11-27T10:00:00Z' }),
    node('wait', { status: 'PENDING' }),
    node('off', { status: 'OFFLINE', last_heartbeat: '2026-11-01T00:00:00Z' }),
  ]

  it('mất kết nối trước chờ kết nối trước online, cùng nhóm thì kết nối gần nhất trước', () => {
    expect(sortDevices(nodes).map(item => item._id)).toEqual(['off', 'wait', 'on-new', 'on-old'])
  })

  it('đếm theo trạng thái cho hàng tab', () => {
    expect(countByStatus(nodes)).toEqual({ ALL: 4, OFFLINE: 1, PENDING: 1, ONLINE: 2 })
  })

  it('vị trí là nhà và Zone; camera không có Zone thì chỉ ghi nhà', () => {
    expect(nodePlace(node('a', {}))).toBe('H · Z')
    expect(nodePlace(node('cam', { type: 'camera', zone_name: '' }))).toBe('H')
  })
})
