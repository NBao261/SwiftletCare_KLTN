import { Types } from 'mongoose'
import { Telemetry } from '@/models/telemetry.model'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { fitPlantModel, searchTuning, simulate, type Step, type Tuning } from '@/utils/fuzzyModel.util'
import type { CurrentUser, FuzzyTuning } from '@/types'

const STEP_MS = 10 * 60_000
const LOOKBACK_MS = 14 * 86400_000
const MIN_DAYS = 3
const MIN_R2 = 0.3
const SIM_STEPS = 144 // 24 giờ
// Dưới mức này coi như đã ổn, không đề xuất cho có
const MIN_IMPROVEMENT = 1

const round1 = (v: number) => Math.round(v * 10) / 10

const toTuning = (t: FuzzyTuning): Tuning =>
  ({ humidityBand: t.fuzzy_humidity_band, tempBand: t.fuzzy_temp_band, fanDryLevel: t.fuzzy_fan_dry_level / 100 })

// Chỉ đề xuất, không ghi. Từ chối khi dữ liệu ít, R² thấp hoặc phi vật lý
export async function getTuningSuggestion(user: CurrentUser, zoneId: string, now = new Date()) {
  const { zone } = await assertZoneAccess(zoneId, user)
  const t = zone.thresholds
  const current = zone.fuzzy_tuning

  const rows = await Telemetry.aggregate<{
    _id: Date; humidity: number | null; temperature: number | null; misting: number | null; ventilation: number | null
  }>([
    { $match: { zone_id: new Types.ObjectId(zoneId), timestamp: { $gte: new Date(now.getTime() - LOOKBACK_MS), $lte: now }, misting_pct: { $exists: true } } },
    {
      $group: {
        _id: { $toDate: { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, STEP_MS] }] } },
        humidity: { $avg: '$humidity' }, temperature: { $avg: '$temperature' },
        misting: { $avg: '$misting_pct' }, ventilation: { $avg: '$ventilation_pct' },
      },
    },
    { $sort: { _id: 1 } },
  ])

  // Mất kết nối thì cắt đoạn
  const runs: Step[][] = []
  let run: Step[] = []
  let prevAt = 0
  for (const r of rows) {
    const ok = [r.humidity, r.temperature, r.misting, r.ventilation].every(v => typeof v === 'number')
    if (!ok || (run.length > 0 && r._id.getTime() - prevAt !== STEP_MS)) {
      if (run.length > 1) runs.push(run)
      run = []
    }
    if (ok) run.push({ humidity: r.humidity!, temperature: r.temperature!, misting: r.misting!, ventilation: r.ventilation! })
    prevAt = r._id.getTime()
  }
  if (run.length > 1) runs.push(run)

  const days = rows.length > 1 ? (rows[rows.length - 1]._id.getTime() - rows[0]._id.getTime()) / 86400_000 : 0
  const model = fitPlantModel(runs)
  const base = { current, model: model ? { r2: round1(model.r2 * 100) / 100, samples: model.samples, days: round1(days) } : null }

  if (days < MIN_DAYS || !model) {
    return { ...base, suggestion: null, reason: `Cần ít nhất ${MIN_DAYS} ngày dữ liệu từ firmware ≥ 1.1.0 (hiện có ${round1(days)} ngày)` }
  }
  if (model.r2 < MIN_R2) {
    return { ...base, suggestion: null, reason: `Dữ liệu chưa đủ khớp để gợi ý (R² = ${round1(model.r2 * 100) / 100} < ${MIN_R2}), gợi ý chưa đáng tin` }
  }
  if (model.a <= 0) {
    return { ...base, suggestion: null, reason: 'Phun sương không làm tăng độ ẩm. Kiểm tra bơm và béc phun trước khi chỉnh hệ số' }
  }

  const day = runs.flat().slice(-SIM_STEPS)
  const limits = { hMin: t.humidity_min, hMax: t.humidity_max, tMax: t.temp_max }
  const currentSim = simulate(model, day, limits, toTuning(current))
  const best = searchTuning(model, day, limits)
  const predicted = {
    inRangeNow: round1(currentSim.inRangePct), inRangeSuggested: round1(best.result.inRangePct),
    mistingNow: Math.round(currentSim.mistingAvgPct), mistingSuggested: Math.round(best.result.mistingAvgPct),
  }
  if (currentSim.score - best.result.score < MIN_IMPROVEMENT) {
    return { ...base, predicted, suggestion: null, reason: 'Hệ số hiện tại đã gần tốt nhất, chưa cần đổi' }
  }
  const suggestion: Partial<FuzzyTuning> = {
    fuzzy_humidity_band: best.tuning.humidityBand,
    fuzzy_temp_band: best.tuning.tempBand,
    fuzzy_fan_dry_level: Math.round(best.tuning.fanDryLevel * 100),
  }
  return { ...base, predicted, suggestion, reason: null }
}
