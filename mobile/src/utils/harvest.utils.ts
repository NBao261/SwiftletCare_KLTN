import type { CreateHarvestPayload, HarvestBatch, HarvestCycleComparison, NestType, UpdateHarvestPayload, User } from '@/types'
import { formatPercentValue } from '@/utils/number.utils'
import { getVietnamDate } from '@/utils/date.utils'
import { canPerform } from '@/utils/permission.utils'
import { parseNumberInput, validateNumber, type NumberRule } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

export interface MonthYield {
  kg: number
  nests: number
  // Số lần thu: nhiều loại yến cùng zone, cùng ngày tính là 1 lần — như web (groupHarvests)
  batches: number
  // Lần thu gần nhất trong tháng
  lastHarvestAt: string
}

const GRAMS_PER_KG = 1000

// Năm-tháng theo giờ Việt Nam, dạng "2026-11"
function getVietnamMonth(time: number): string {
  return getVietnamDate(time).slice(0, 7)
}

// Sản lượng tháng này (giờ Việt Nam) của một nhà: cộng các đợt thu đã xác nhận của các zone thuộc nhà, bỏ đợt đã xoá mềm
// (HARVEST-FR-005) và đợt còn chờ xác nhận (BR-43). Cách tính như ô "Sản lượng tháng" của web; tháng chưa thu thì null
export function summarizeHouseMonthYield(
  batches: HarvestBatch[],
  zoneIds: readonly string[],
  now: number = Date.now(),
): MonthYield | null {
  const zoneIdSet = new Set(zoneIds)
  const month = getVietnamMonth(now)
  const runKeys = new Set<string>()
  let grams = 0
  let nests = 0
  let lastHarvestAt: string | null = null

  for (const batch of batches) {
    if (batch.is_deleted || batch.status === 'DRAFT' || !zoneIdSet.has(batch.zone_id)) continue
    if (getVietnamMonth(Date.parse(batch.harvest_date)) !== month) continue
    grams += batch.weight_grams
    nests += batch.nest_count
    runKeys.add(`${batch.zone_id}|${batch.harvest_date}`)
    if (!lastHarvestAt || batch.harvest_date > lastHarvestAt) lastHarvestAt = batch.harvest_date
  }

  if (!lastHarvestAt) return null
  return { kg: grams / GRAMS_PER_KG, nests, batches: runKeys.size, lastHarvestAt }
}

// Ba loại tổ theo thứ tự xếp chồng từ dưới lên, như web: yến trắng → hồng → huyết
export const NEST_TYPES: readonly NestType[] = ['RAW', 'CLEANED', 'PREMIUM']

// Gộp sản lượng theo tháng, quý của một năm, hoặc theo từng năm có dữ liệu (ANALYTICS-FR-004)
export type HarvestPeriod = 'month' | 'quarter' | 'year'

export interface HarvestPeriodTotals {
  // Số thứ tự từng cột: tháng 1–12, quý 1–4, hoặc năm
  buckets: number[]
  // Kg và số tổ của từng loại tổ trong từng cột, để xếp chồng theo loại
  kilogramsByType: Record<NestType, number[]>
  nestsByType: Record<NestType, number[]>
  // Số lần thu trong từng cột: nhiều loại yến cùng zone, cùng ngày tính là 1 lần
  runs: number[]
}

const MONTHS_PER_QUARTER = 3

// Năm, tháng theo giờ Việt Nam của một ngày thu
function getVietnamYearMonth(isoDate: string): { year: number; month: number } {
  const [year, month] = getVietnamDate(Date.parse(isoDate)).split('-').map(Number)
  return { year, month }
}

// Đợt thu còn hiệu lực của các zone đang xem (bỏ đợt đã xoá mềm — HARVEST-FR-005)
function filterBatches(batches: HarvestBatch[], zoneIds: readonly string[]): HarvestBatch[] {
  const zoneIdSet = new Set(zoneIds)
  return batches.filter(batch => !batch.is_deleted && zoneIdSet.has(batch.zone_id))
}

// Đợt tính vào sản lượng: thêm điều kiện đã xác nhận (BR-43, như web); lô cũ không có status coi như đã xác nhận
function filterConfirmedBatches(batches: HarvestBatch[], zoneIds: readonly string[]): HarvestBatch[] {
  return filterBatches(batches, zoneIds).filter(batch => batch.status !== 'DRAFT')
}

// Tổng kg, số tổ theo loại tổ và số lần thu của từng cột (chỉ đợt đã xác nhận) — cùng cách tính biểu đồ năm của web
export function harvestTotalsByPeriod(
  batches: HarvestBatch[],
  zoneIds: readonly string[],
  period: HarvestPeriod,
  year: number,
): HarvestPeriodTotals {
  const valid = filterConfirmedBatches(batches, zoneIds)
  const buckets =
    period === 'year'
      ? [...new Set(valid.map(batch => getVietnamYearMonth(batch.harvest_date).year))].sort(
          (first, second) => first - second,
        )
      : Array.from({ length: period === 'month' ? 12 : 4 }, (_, index) => index + 1)
  const indexByBucket = new Map(buckets.map((bucket, index) => [bucket, index]))
  const emptyByType = (): Record<NestType, number[]> => ({
    RAW: new Array<number>(buckets.length).fill(0),
    CLEANED: new Array<number>(buckets.length).fill(0),
    PREMIUM: new Array<number>(buckets.length).fill(0),
  })
  const kilogramsByType = emptyByType()
  const nestsByType = emptyByType()
  const runKeys = buckets.map(() => new Set<string>())

  for (const batch of valid) {
    const harvestMonth = getVietnamYearMonth(batch.harvest_date)
    if (period !== 'year' && harvestMonth.year !== year) continue
    const bucket =
      period === 'year'
        ? harvestMonth.year
        : period === 'month'
          ? harvestMonth.month
          : Math.floor((harvestMonth.month - 1) / MONTHS_PER_QUARTER) + 1
    const index = indexByBucket.get(bucket)
    if (index === undefined) continue
    kilogramsByType[batch.nest_type][index] += batch.weight_grams / GRAMS_PER_KG
    nestsByType[batch.nest_type][index] += batch.nest_count
    runKeys[index].add(`${batch.zone_id}|${batch.harvest_date}`)
  }
  return { buckets, kilogramsByType, nestsByType, runs: runKeys.map(keys => keys.size) }
}

// Các năm có đợt thu của các zone đang xem (luôn gồm năm hiện tại), mới nhất trước — cho bộ chuyển năm
export function harvestYears(batches: HarvestBatch[], zoneIds: readonly string[], currentYear: number): number[] {
  const years = new Set<number>([currentYear])
  for (const batch of filterConfirmedBatches(batches, zoneIds)) years.add(getVietnamYearMonth(batch.harvest_date).year)
  return [...years].sort((first, second) => second - first)
}

// Một lần thu: các đợt (mỗi loại yến một đợt) cùng zone, cùng ngày thu — backend không có mã nhóm, như web (groupHarvests)
export interface HarvestRun {
  key: string
  zone_id: string
  harvest_date: string
  batchByType: Partial<Record<NestType, HarvestBatch>>
  // Các loại có trong lần thu, theo thứ tự yến trắng → hồng → huyết
  nestTypes: NestType[]
  nest_count: number
  weight_grams: number
  // Còn lô DRAFT do kỹ thuật viên nhập, chờ chủ trại xác nhận (HARVEST-FR-006)
  isPending: boolean
  // Ảnh sản phẩm dùng chung của lần thu (web ghi cùng link cho mọi loại)
  product_images: string[]
}

// Khoá lần thu của một đợt
function getRunKey(batch: Pick<HarvestBatch, 'zone_id' | 'harvest_date'>): string {
  return `${batch.zone_id}|${batch.harvest_date}`
}

// Gom đợt thu của các zone đang xem thành lần thu, giữ thứ tự backend trả (ngày mới nhất trước), bỏ đợt đã xoá mềm
export function groupHarvestRuns(batches: HarvestBatch[], zoneIds: readonly string[]): HarvestRun[] {
  const runByKey = new Map<string, HarvestRun>()
  for (const batch of filterBatches(batches, zoneIds)) {
    const key = getRunKey(batch)
    const run = runByKey.get(key) ?? {
      key,
      zone_id: batch.zone_id,
      harvest_date: batch.harvest_date,
      batchByType: {},
      nestTypes: [],
      nest_count: 0,
      weight_grams: 0,
      isPending: false,
      product_images: [],
    }
    run.batchByType[batch.nest_type] = batch
    run.nest_count += batch.nest_count
    run.weight_grams += batch.weight_grams
    run.isPending = run.isPending || batch.status === 'DRAFT'
    if (run.product_images.length === 0) run.product_images = batch.product_images ?? []
    runByKey.set(key, run)
  }
  const runs = [...runByKey.values()]
  for (const run of runs) run.nestTypes = NEST_TYPES.filter(type => run.batchByType[type])
  return runs
}

// Kỹ thuật viên chỉ sửa, xoá lần thu khi mọi lô còn DRAFT và do chính mình nhập (HARVEST-FR-005); chủ trại sửa mọi lần thu
export function canEditHarvestRun(user: User | null, run: HarvestRun): boolean {
  if (canPerform(user, 'editAnyHarvest')) return true
  if (!user || !canPerform(user, 'recordHarvest')) return false
  return NEST_TYPES.every(type => {
    const batch = run.batchByType[type]
    return !batch || (batch.status === 'DRAFT' && batch.created_by === user._id)
  })
}

// Chữ người dùng gõ cho một loại yến: số tổ và khối lượng (gram)
export interface NestAmountText {
  nests: string
  grams: string
}

export interface NestAmountCheck {
  nests: number
  grams: number
  // Có đủ cả số tổ và khối lượng: thành một đợt thu
  isFilled: boolean
  // Câu lỗi của dòng; dòng trống cả hai ô là không thu loại này, không lỗi
  error: string | null
}

// Số tổ, khối lượng không âm; kiểm "> 0" ở bước dưới vì dòng trống cả hai là hợp lệ
const NEST_COUNT_RULE: NumberRule = { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true }
const WEIGHT_GRAMS_RULE: NumberRule = { min: 0, max: Number.MAX_SAFE_INTEGER }

// Kiểm một dòng loại yến như form web (checkNestAmount) và backend (nest_count nguyên ≥ 1, weight_grams > 0 — HARVEST-FR-001)
export function checkNestAmount(amount: NestAmountText): NestAmountCheck {
  const nestsText = amount.nests.trim()
  const gramsText = amount.grams.trim()
  const formatError =
    (nestsText ? validateNumber(nestsText, NEST_COUNT_RULE) : null) ??
    (gramsText ? validateNumber(gramsText, WEIGHT_GRAMS_RULE) : null)
  if (formatError) return { nests: 0, grams: 0, isFilled: false, error: formatError }
  const nests = nestsText ? (parseNumberInput(nestsText) ?? 0) : 0
  const grams = gramsText ? (parseNumberInput(gramsText) ?? 0) : 0
  if (nests === 0 && grams === 0) return { nests, grams, isFilled: false, error: null }
  if (nests === 0 || grams === 0) {
    return { nests, grams, isFilled: false, error: t('Điền cả số tổ và trọng lượng') }
  }
  return { nests, grams, isFilled: true, error: null }
}

// Ngày thu sớm nhất được chọn — chặn năm gõ nhầm như web (HARVEST_DATE_MIN)
export const HARVEST_DATE_MIN = '2000-01-01'

// Ngày thu là 0 giờ giờ Việt Nam của ngày đã chọn, như web; backend chặn ngày sau hôm nay theo giờ Việt Nam
export function toHarvestDateIso(date: string): string {
  return `${date}T00:00:00+07:00`
}

// Một thao tác lưu của một loại yến khi ghi hoặc sửa một lần thu
export type HarvestOperation =
  | { kind: 'create'; nestType: NestType; payload: CreateHarvestPayload }
  | { kind: 'update'; nestType: NestType; harvestId: string; payload: UpdateHarvestPayload }
  | { kind: 'remove'; nestType: NestType; harvestId: string }

export interface HarvestRunDraft {
  zoneId: string
  harvestDateIso: string
  // Dòng đã kiểm của từng loại; dòng không đủ số thì không thành đợt
  checks: Record<NestType, NestAmountCheck>
  // Đợt đang có của lần thu theo loại (sửa, hoặc đã lưu được ở lần bấm trước)
  existing: Partial<Record<NestType, HarvestBatch>>
  productImages: string[]
}

// Mỗi loại: có số và đã có đợt thì sửa (chỉ khi đổi số), có số mà chưa có thì tạo, hết số mà đã có thì xoá — như web
export function planHarvestRunOperations(draft: HarvestRunDraft): HarvestOperation[] {
  return NEST_TYPES.flatMap<HarvestOperation>(nestType => {
    const check = draft.checks[nestType]
    const batch = draft.existing[nestType]
    if (check.isFilled && batch) {
      if (batch.nest_count === check.nests && batch.weight_grams === check.grams) return []
      return [
        { kind: 'update', nestType, harvestId: batch._id, payload: { nest_count: check.nests, weight_grams: check.grams } },
      ]
    }
    if (check.isFilled) {
      return [
        {
          kind: 'create',
          nestType,
          payload: {
            zone_id: draft.zoneId,
            harvest_date: draft.harvestDateIso,
            nest_count: check.nests,
            weight_grams: check.grams,
            nest_type: nestType,
            product_images: draft.productImages,
          },
        },
      ]
    }
    if (batch) return [{ kind: 'remove', nestType, harvestId: batch._id }]
    return []
  })
}

// Chênh lệch một chu kỳ với chu kỳ đem so (HARVEST-FR-007): "+12 % khối lượng · −5 % số tổ"; không có chu kỳ để so thì "_"
export function formatCycleComparison(comparison: HarvestCycleComparison | null | undefined): string {
  if (!comparison || (comparison.weight_change_pct === null && comparison.nest_count_change_pct === null)) return '_'
  const formatChange = (value: number) => `${value > 0 ? '+' : ''}${formatPercentValue(value, 0)}`
  const parts: string[] = []
  if (comparison.weight_change_pct !== null) {
    parts.push(t('{change} khối lượng', { change: formatChange(comparison.weight_change_pct) }))
  }
  if (comparison.nest_count_change_pct !== null) {
    parts.push(t('{change} số tổ', { change: formatChange(comparison.nest_count_change_pct) }))
  }
  return parts.join(' · ')
}
