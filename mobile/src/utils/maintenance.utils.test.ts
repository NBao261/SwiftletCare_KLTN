import { describe, expect, it } from '@jest/globals'
import type { MaintenancePlan, SensorNode } from '@/types'
import {
  describePlanProgress,
  formatMaintenanceDate,
  getChecklistProgress,
  getPlanUsage,
  sortPlansByUrgency,
} from '@/utils/maintenance.utils'

describe('getChecklistProgress (OPS-FR-007)', () => {
  it('đếm mục đã ghi, mục hỏng; đủ khi mọi mục có kết quả (null hoặc thiếu là chưa làm)', () => {
    const progress = getChecklistProgress([
      { item: 'Bồn nước', result: 'OK' },
      { item: 'Béc phun', result: 'DEFECT' },
      { item: 'Quạt', result: null },
      { item: 'Cửa' },
    ])
    expect(progress).toEqual({ done: 2, total: 4, defects: 1, isComplete: false })
    expect(getChecklistProgress([{ item: 'Bồn nước', result: 'OK' }]).isComplete).toBe(true)
  })

  it('Work Order không có checklist thì coi như đủ', () => {
    expect(getChecklistProgress(undefined)).toEqual({ done: 0, total: 0, defects: 0, isComplete: true })
  })
})

describe('getPlanUsage (BR-45)', () => {
  const zoneById = new Map([
    ['zone-1', { house_id: 'house-1' }],
    ['zone-2', { house_id: 'house-1' }],
    ['zone-9', { house_id: 'house-9' }],
  ])
  // Controller tối thiểu cho test: chỉ zone và bộ đếm
  const buildNode = (zoneId: string, hours: number, switches: number) =>
    ({
      _id: zoneId,
      zone_id: zoneId,
      relay_usage: { misting: { since_service_hours: hours, since_service_switches: switches } },
    }) as unknown as SensorNode
  const nodes = [buildNode('zone-1', 120.5, 40), buildNode('zone-2', 499, 12), buildNode('zone-9', 900, 900)]

  it('bơm theo giờ chạy lấy số lớn nhất trong các controller của nhà, bỏ nhà khác', () => {
    expect(getPlanUsage({ equipment: 'PUMP', basis: 'RUN_HOURS', house_id: 'house-1' }, nodes, zoneById)).toEqual({
      used: 499,
    })
    expect(getPlanUsage({ equipment: 'PUMP', basis: 'SWITCHES', house_id: 'house-1' }, nodes, zoneById)).toEqual({
      used: 40,
    })
  })

  it('kế hoạch theo lịch, thiết bị không có bộ đếm, hoặc chưa có số thì null', () => {
    expect(getPlanUsage({ equipment: 'SENSOR', basis: 'CALENDAR', house_id: 'house-1' }, nodes, zoneById)).toBeNull()
    expect(getPlanUsage({ equipment: 'FAN', basis: 'RUN_HOURS', house_id: 'house-1' }, nodes, zoneById)).toBeNull()
  })
})

describe('describePlanProgress', () => {
  it('giờ chạy, số lần đóng cắt so với chu kỳ; theo lịch là hạn kế tiếp; chưa có số thì chu kỳ', () => {
    expect(describePlanProgress({ basis: 'RUN_HOURS', interval: 500 }, { used: 499 })).toBe('Đã chạy 499,0/500 giờ')
    expect(describePlanProgress({ basis: 'SWITCHES', interval: 2000 }, { used: 40 })).toBe('Đã đóng cắt 40/2.000 lần')
    expect(describePlanProgress({ basis: 'CALENDAR', interval: 30, next_due_at: '2026-12-01T00:00:00+07:00' }, null)).toBe(
      'Hạn kế tiếp 01/12/2026',
    )
    expect(describePlanProgress({ basis: 'RUN_HOURS', interval: 500 }, null)).toBe('Chu kỳ 500 giờ chạy')
  })

  it('ngày theo giờ Việt Nam, không theo múi giờ của máy', () => {
    expect(formatMaintenanceDate('2026-11-30T17:00:00.000Z')).toBe('01/12/2026')
  })
})

describe('sortPlansByUrgency', () => {
  it('quá hạn, đến hạn, theo lịch, đã xoá; cùng trạng thái giữ thứ tự cũ', () => {
    const plans = (['SCHEDULED', 'OVERDUE', 'DUE', 'RETIRED', 'OVERDUE'] as const).map(
      (state, index) => ({ _id: String(index), state }) as MaintenancePlan,
    )
    expect(sortPlansByUrgency(plans).map(plan => plan._id)).toEqual(['1', '4', '2', '0', '3'])
  })
})
