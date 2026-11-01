import { describe, expect, it } from '@jest/globals'
import type { HarvestBatch } from '@/types'
import { harvestTotalsByPeriod, harvestYears, summarizeHouseMonthYield } from '@/utils/harvest.utils'

// 15/11/2026 10:00 giờ Việt Nam
const now = new Date('2026-11-15T03:00:00.000Z').getTime()

// Đợt thu tối thiểu cho test
function buildBatch(id: string, zoneId: string, harvestDate: string, values: Partial<HarvestBatch> = {}): HarvestBatch {
  return {
    _id: id,
    farm_id: 'farm-1',
    zone_id: zoneId,
    harvest_date: harvestDate,
    nest_count: 10,
    weight_grams: 1000,
    nest_type: 'RAW',
    ...values,
  }
}

describe('summarizeHouseMonthYield', () => {
  it('chỉ cộng đợt của zone thuộc nhà, trong tháng này', () => {
    const batches = [
      buildBatch('a', 'zone-1', '2026-11-10T01:00:00.000Z', { nest_count: 40, weight_grams: 5200 }),
      buildBatch('b', 'zone-2', '2026-11-12T01:00:00.000Z', { nest_count: 46, weight_grams: 7200 }),
      buildBatch('c', 'zone-other', '2026-11-12T01:00:00.000Z'),
      buildBatch('d', 'zone-1', '2026-10-20T01:00:00.000Z'),
    ]
    expect(summarizeHouseMonthYield(batches, ['zone-1', 'zone-2'], now)).toEqual({
      kg: 12.4,
      nests: 86,
      batches: 2,
      lastHarvestAt: '2026-11-12T01:00:00.000Z',
    })
  })

  it('nhiều loại yến cùng zone, cùng ngày là 1 lần thu', () => {
    const date = '2026-11-10T01:00:00.000Z'
    const batches = [
      buildBatch('a', 'zone-1', date, { nest_type: 'RAW' }),
      buildBatch('b', 'zone-1', date, { nest_type: 'CLEANED' }),
    ]
    expect(summarizeHouseMonthYield(batches, ['zone-1'], now)?.batches).toBe(1)
  })

  it('tính tháng theo giờ Việt Nam: 17:30 UTC ngày 31/10 là 01/11 giờ Việt Nam', () => {
    const batches = [buildBatch('a', 'zone-1', '2026-10-31T17:30:00.000Z')]
    expect(summarizeHouseMonthYield(batches, ['zone-1'], now)?.batches).toBe(1)
  })

  it('bỏ đợt đã xoá mềm; tháng chưa thu thì null', () => {
    const batches = [buildBatch('a', 'zone-1', '2026-11-10T01:00:00.000Z', { is_deleted: true })]
    expect(summarizeHouseMonthYield(batches, ['zone-1'], now)).toBeNull()
  })
})

describe('harvestTotalsByPeriod', () => {
  const batches = [
    buildBatch('a', 'zone-1', '2026-11-10T01:00:00.000Z', { nest_count: 40, weight_grams: 5200 }),
    buildBatch('b', 'zone-1', '2026-11-10T01:00:00.000Z', { nest_count: 6, weight_grams: 800, nest_type: 'PREMIUM' }),
    buildBatch('c', 'zone-2', '2026-02-03T01:00:00.000Z', { nest_count: 20, weight_grams: 2500, nest_type: 'CLEANED' }),
    buildBatch('d', 'zone-other', '2026-11-12T01:00:00.000Z'),
    buildBatch('e', 'zone-1', '2025-12-31T18:00:00.000Z', { is_deleted: true }),
    buildBatch('f', 'zone-1', '2025-12-31T16:00:00.000Z'),
  ]
  const zoneIds = ['zone-1', 'zone-2']

  it('theo tháng: tách theo loại tổ, đếm cùng zone cùng ngày là 1 lần thu, bỏ zone khác và đợt đã xoá', () => {
    const totals = harvestTotalsByPeriod(batches, zoneIds, 'month', 2026)
    expect(totals.buckets).toHaveLength(12)
    expect(totals.kilogramsByType.RAW[10]).toBeCloseTo(5.2)
    expect(totals.kilogramsByType.PREMIUM[10]).toBeCloseTo(0.8)
    expect(totals.nestsByType.CLEANED[1]).toBe(20)
    expect(totals.runs[10]).toBe(1)
  })

  it('theo quý và theo năm, ngày theo giờ Việt Nam (31/12 23:00 UTC+7 vẫn là năm cũ)', () => {
    expect(harvestTotalsByPeriod(batches, zoneIds, 'quarter', 2026).runs).toEqual([1, 0, 0, 1])
    const yearly = harvestTotalsByPeriod(batches, zoneIds, 'year', 2026)
    expect(yearly.buckets).toEqual([2025, 2026])
    expect(yearly.runs).toEqual([1, 2])
  })

  it('các năm có dữ liệu, luôn gồm năm hiện tại, mới nhất trước', () => {
    expect(harvestYears(batches, zoneIds, 2027)).toEqual([2027, 2026, 2025])
  })
})
