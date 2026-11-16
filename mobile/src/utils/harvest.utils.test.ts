import { describe, expect, it } from '@jest/globals'
import type { HarvestBatch, User } from '@/types'
import {
  canEditHarvestRun,
  checkNestAmount,
  groupHarvestRuns,
  harvestTotalsByPeriod,
  harvestYears,
  planHarvestRunOperations,
  summarizeHouseMonthYield,
  toHarvestDateIso,
  type NestAmountCheck,
} from '@/utils/harvest.utils'

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

describe('đợt chờ xác nhận không tính vào sản lượng (BR-43)', () => {
  it('ô sản lượng tháng và biểu đồ bỏ đợt DRAFT, giữ đợt cũ không có status', () => {
    const batches = [
      buildBatch('a', 'zone-1', '2026-11-10T01:00:00.000Z', { status: 'CONFIRMED', weight_grams: 2000 }),
      buildBatch('b', 'zone-1', '2026-11-11T01:00:00.000Z', { status: 'DRAFT', weight_grams: 9000 }),
      buildBatch('c', 'zone-1', '2026-11-12T01:00:00.000Z', { weight_grams: 1000 }),
    ]
    expect(summarizeHouseMonthYield(batches, ['zone-1'], now)?.kg).toBeCloseTo(3)
    expect(harvestTotalsByPeriod(batches, ['zone-1'], 'month', 2026).runs[10]).toBe(2)
  })
})

describe('groupHarvestRuns', () => {
  it('gom các loại yến cùng zone, cùng ngày thành một lần thu, giữ thứ tự backend, bỏ đợt đã xoá và zone khác', () => {
    const batches = [
      buildBatch('a', 'zone-1', '2026-11-12T17:00:00.000Z', { nest_type: 'PREMIUM', nest_count: 5, weight_grams: 600 }),
      buildBatch('b', 'zone-1', '2026-11-12T17:00:00.000Z', { nest_count: 40, weight_grams: 5000, status: 'DRAFT' }),
      buildBatch('c', 'zone-1', '2026-11-01T17:00:00.000Z', { status: 'CONFIRMED' }),
      buildBatch('d', 'zone-1', '2026-11-01T17:00:00.000Z', { nest_type: 'CLEANED', is_deleted: true }),
      buildBatch('e', 'zone-other', '2026-11-12T17:00:00.000Z'),
    ]
    const runs = groupHarvestRuns(batches, ['zone-1'])
    expect(runs.map(run => run.harvest_date)).toEqual(['2026-11-12T17:00:00.000Z', '2026-11-01T17:00:00.000Z'])
    expect(runs[0].nestTypes).toEqual(['RAW', 'PREMIUM'])
    expect(runs[0].nest_count).toBe(45)
    expect(runs[0].weight_grams).toBe(5600)
    expect(runs[0].isPending).toBe(true)
    expect(runs[1].nestTypes).toEqual(['RAW'])
    expect(runs[1].isPending).toBe(false)
  })
})

describe('canEditHarvestRun', () => {
  const owner = { _id: 'owner-1', role: 'FARM_OWNER' } as User
  const technician = { _id: 'technician-1', role: 'FARM_TECHNICIAN' } as User
  const expert = { _id: 'expert-1', role: 'DOMAIN_EXPERT' } as User
  const runOf = (values: Partial<HarvestBatch>) =>
    groupHarvestRuns([buildBatch('a', 'zone-1', '2026-11-12T17:00:00.000Z', values)], ['zone-1'])[0]

  it('chủ trại sửa mọi lần thu, chuyên gia không sửa', () => {
    const run = runOf({ status: 'CONFIRMED', created_by: 'someone' })
    expect(canEditHarvestRun(owner, run)).toBe(true)
    expect(canEditHarvestRun(expert, run)).toBe(false)
    expect(canEditHarvestRun(null, run)).toBe(false)
  })

  it('kỹ thuật viên chỉ sửa lần thu còn DRAFT do chính mình nhập (HARVEST-FR-005)', () => {
    expect(canEditHarvestRun(technician, runOf({ status: 'DRAFT', created_by: 'technician-1' }))).toBe(true)
    expect(canEditHarvestRun(technician, runOf({ status: 'CONFIRMED', created_by: 'technician-1' }))).toBe(false)
    expect(canEditHarvestRun(technician, runOf({ status: 'DRAFT', created_by: 'technician-2' }))).toBe(false)
  })
})

describe('checkNestAmount', () => {
  it('dòng trống là không thu loại này, không lỗi', () => {
    expect(checkNestAmount({ nests: '', grams: ' ' })).toEqual({ nests: 0, grams: 0, isFilled: false, error: null })
  })

  it('đủ số tổ và khối lượng thì thành một đợt, nhận dấu phẩy thập phân', () => {
    expect(checkNestAmount({ nests: '40', grams: '5200,5' })).toEqual({
      nests: 40,
      grams: 5200.5,
      isFilled: true,
      error: null,
    })
  })

  it('báo lỗi khi thiếu một ô, số tổ lẻ, số âm hoặc chữ', () => {
    expect(checkNestAmount({ nests: '40', grams: '' }).error).toBe('Điền cả số tổ và trọng lượng')
    expect(checkNestAmount({ nests: '0', grams: '300' }).error).toBe('Điền cả số tổ và trọng lượng')
    expect(checkNestAmount({ nests: '2,5', grams: '300' }).error).toBe('Nhập số nguyên')
    expect(checkNestAmount({ nests: '-1', grams: '300' }).error).toBe('Từ 0 trở lên')
    expect(checkNestAmount({ nests: '4', grams: 'abc' }).error).toBe('Nhập một số')
  })

  it('không hiểu nhầm "1.500" là 1,5 gram khi dùng tiếng Việt', () => {
    expect(checkNestAmount({ nests: '4', grams: '1.500' }).error).toBe('Nhập số không có dấu ngăn nghìn')
  })

  it('số lẻ 3 chữ số viết dấu phẩy (ô sửa lấy từ toInputText) vẫn hợp lệ', () => {
    expect(checkNestAmount({ nests: '4', grams: '2,125' })).toEqual({ nests: 4, grams: 2.125, isFilled: true, error: null })
  })
})

describe('planHarvestRunOperations', () => {
  const empty: NestAmountCheck = { nests: 0, grams: 0, isFilled: false, error: null }
  const filled = (nests: number, grams: number): NestAmountCheck => ({ nests, grams, isFilled: true, error: null })
  const harvestDateIso = toHarvestDateIso('2026-11-16')

  it('ghi mới: mỗi loại có số là một đợt cùng zone, cùng ngày 0 giờ giờ Việt Nam', () => {
    const operations = planHarvestRunOperations({
      zoneId: 'zone-1',
      harvestDateIso,
      checks: { RAW: filled(40, 5000), CLEANED: empty, PREMIUM: filled(5, 600) },
      existing: {},
      productImages: [],
    })
    expect(harvestDateIso).toBe('2026-11-16T00:00:00+07:00')
    expect(operations).toEqual([
      {
        kind: 'create',
        nestType: 'RAW',
        payload: {
          zone_id: 'zone-1',
          harvest_date: harvestDateIso,
          nest_count: 40,
          weight_grams: 5000,
          nest_type: 'RAW',
          product_images: [],
        },
      },
      {
        kind: 'create',
        nestType: 'PREMIUM',
        payload: {
          zone_id: 'zone-1',
          harvest_date: harvestDateIso,
          nest_count: 5,
          weight_grams: 600,
          nest_type: 'PREMIUM',
          product_images: [],
        },
      },
    ])
  })

  it('sửa: không gửi loại không đổi số, xoá loại bị bỏ trống, tạo loại mới thêm', () => {
    const operations = planHarvestRunOperations({
      zoneId: 'zone-1',
      harvestDateIso,
      checks: { RAW: filled(40, 5000), CLEANED: filled(10, 900), PREMIUM: empty },
      existing: {
        RAW: buildBatch('raw-1', 'zone-1', harvestDateIso, { nest_count: 40, weight_grams: 5000 }),
        PREMIUM: buildBatch('premium-1', 'zone-1', harvestDateIso, { nest_type: 'PREMIUM' }),
      },
      productImages: ['https://example.com/a.jpg'],
    })
    expect(operations.map(operation => `${operation.kind}:${operation.nestType}`)).toEqual([
      'create:CLEANED',
      'remove:PREMIUM',
    ])
  })

  it('đổi số của loại đã có thì sửa đúng đợt đó', () => {
    const operations = planHarvestRunOperations({
      zoneId: 'zone-1',
      harvestDateIso,
      checks: { RAW: filled(42, 5100), CLEANED: empty, PREMIUM: empty },
      existing: { RAW: buildBatch('raw-1', 'zone-1', harvestDateIso) },
      productImages: [],
    })
    expect(operations).toEqual([
      { kind: 'update', nestType: 'RAW', harvestId: 'raw-1', payload: { nest_count: 42, weight_grams: 5100 } },
    ])
  })
})
