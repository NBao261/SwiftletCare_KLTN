import { describe, expect, it } from 'vitest'
import { zoneIssues } from '@/components/features/technician/farms/zoneIssues'
import type { ZoneNode } from '@/components/features/farm-owner/farms/farmStructure'

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key}:${Object.values(params).join(',')}` : key)
const num = (value: number) => String(value)
const zone = (patch: Partial<ZoneNode>) => ({ breaches: [], alerts: [], counts: { total: 2, online: 2, offline: 0 }, ...patch }) as Pick<ZoneNode, 'breaches' | 'alerts' | 'counts'>

describe('việc cần xử lý của một Zone', () => {
  it('Zone bình thường không có việc nào', () => {
    expect(zoneIssues(zone({}), t, num)).toEqual([])
  })

  it('số đo vượt ngưỡng, loại cảnh báo (mỗi loại một lần) và thiết bị mất kết nối', () => {
    const issues = zoneIssues(zone({
      breaches: [{ metric: 'temperature', value: 33.5, limit: 31, direction: 'high' }, { metric: 'humidity', value: 60, limit: 75, direction: 'low' }],
      alerts: [{ type: 'NODE_OFFLINE' }, { type: 'NODE_OFFLINE' }, { type: 'SENSOR_FAULT' }] as ZoneNode['alerts'],
      counts: { total: 2, online: 1, offline: 1 },
    }), t, num)
    expect(issues).toEqual([
      'zone.over:metric.temperature (33.5 °C)', 'zone.under:metric.humidity (60 %)',
      'alert.NODE_OFFLINE', 'alert.SENSOR_FAULT', 'tech.zoneOffline:1',
    ])
  })
})
