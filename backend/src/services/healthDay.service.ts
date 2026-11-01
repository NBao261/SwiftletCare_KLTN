import { Types } from 'mongoose'
import { HouseHealthDay, type IHouseHealthDay } from '@/models/houseHealthDay.model'
import { House } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { logAction } from '@/services/auditLog.service'
import { vnDate } from '@/services/birdCount.service'
import { RATING_WINDOW_DAYS, addDays, vnDayStart } from '@/services/healthAssessment.service'
import { AppError, BadRequestError, NotFoundError } from '@/utils/appError.util'
import {
  ORDERED_STATUSES, agreementWithCI, confusionMatrix, falseAlarmRate, gwetAC1, linearWeightedKappa,
  type OrderedStatus, type RatingPair,
} from '@/utils/agreement.util'
import { assertFarmAccess, assertHouseAccess } from '@/utils/farmAccess.util'
import { formatReason, type ReasonLang } from '@/utils/healthReason.util'
import type { CurrentUser, FarmMemberRole, HealthLevel, HealthRatingState, HealthRatingValue, HealthSource } from '@/types'

/**
 * EXPERT-FR-012, BR-31, SM-18 — chấm độc lập trạng thái ngày. Người chưa chấm (hoặc chưa bỏ qua) một
 * ngày còn trong hạn thì MỌI đường đọc (ngày, danh sách, CSV, độ khớp) không trả trạng thái, lý do, mức
 * của chỉ số hay điểm của người khác — che ở server, không dựa vào màn hình.
 */

/** Khoảng đọc tối đa 1 lần (EXPERT-FR-005: báo cáo theo yêu cầu tới 31 ngày) */
export const MAX_DAY_RANGE = 31
/** ponytail: độ khớp đọc tối đa 1 năm mỗi lần, chặn truy vấn quá lớn (giới hạn kỹ thuật, SRS §0.5) */
export const MAX_EVALUATION_RANGE = 366
const SOURCES: HealthSource[] = ['environment', 'air', 'flock', 'noise']
const LEVEL_TO_STATUS: Record<HealthLevel, OrderedStatus> = { NORMAL: 'GOOD', SLIGHT: 'WATCH', CLEAR: 'ACTION' }

const ratingClosed = (message: string) => new AppError(409, 'RATING_CLOSED', message)

/** Hết hạn chấm: đầu ngày thứ 8 sau ngày đó (giờ VN) — ngày D chấm được tới hết ngày D + 7 */
export const ratingDeadline = (date: string) => vnDayStart(addDays(date, RATING_WINDOW_DAYS + 1))

/** SM-18 — suy ra từ ratings và ngày, không lưu */
export function ratingState(day: Pick<IHouseHealthDay, 'date' | 'ratings'>, userId: string, now = new Date()): HealthRatingState {
  const mine = day.ratings.find(r => String(r.by) === userId)
  if (mine) return mine.outcome
  return now < ratingDeadline(day.date) ? 'PENDING' : 'EXPIRED'
}

type LeanDay = IHouseHealthDay & { _id: Types.ObjectId }

async function userNames(days: LeanDay[]): Promise<Map<string, string>> {
  const ids = [...new Set(days.flatMap(d => d.ratings.map(r => String(r.by))))]
  if (ids.length === 0) return new Map()
  const users = await User.find({ _id: { $in: ids } }).select('full_name').lean()
  return new Map(users.map(u => [String(u._id), u.full_name]))
}

/** Bản trả cho client — đang PENDING thì chỉ còn nhà, ngày, thời tiết và hạn chấm */
function present(day: LeanDay, houseName: string, user: CurrentUser, names: Map<string, string>, now: Date) {
  const state = ratingState(day, user._id, now)
  const base = {
    _id: String(day._id),
    house_id: String(day.house_id),
    house_name: houseName,
    farm_id: String(day.farm_id),
    date: day.date,
    weather: day.weather ?? null,
    computed_at: day.computed_at,
    my_rating_state: state,
    rating_deadline: ratingDeadline(day.date),
  }
  if (state === 'PENDING') return base
  return {
    ...base,
    indicators: day.indicators,
    completeness: day.completeness,
    current_status: day.current_status,
    current_reasons: day.current_reasons,
    evidence: { noise_alert_ids: (day.evidence?.noise_alert_ids ?? []).map(String) },
    ratings: day.ratings.map(r => ({
      _id: String(r._id),
      by: { _id: String(r.by), full_name: names.get(String(r.by)) ?? null },
      role: r.role,
      outcome: r.outcome,
      rating: r.rating ?? null,
      note: r.note ?? null,
      at: r.at,
      snapshot: { status: r.snapshot.status, reasons: r.snapshot.reasons },
    })),
  }
}
export type PresentedDay = ReturnType<typeof present>

/** houseId hoặc farmId (một trong hai) → danh sách nhà người gọi được xem */
async function resolveHouses(user: CurrentUser, params: { houseId?: string; farmId?: string }) {
  if (params.houseId) {
    const { house } = await assertHouseAccess(params.houseId, user)
    return [house]
  }
  if (params.farmId) {
    await assertFarmAccess(params.farmId, user)
    return House.find({ farm_id: params.farmId }).select('name farm_id').lean()
  }
  throw BadRequestError('Cần houseId hoặc farmId')
}

/** from/to 'YYYY-MM-DD'; mặc định 7 ngày tới hôm nay */
function resolveRange(params: { from?: string; to?: string }, max: number, now: Date) {
  const to = params.to ?? vnDate(now)
  const from = params.from ?? addDays(to, -6)
  if (from > to) throw BadRequestError('from phải không sau to')
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1
  if (days > max) throw BadRequestError(`Khoảng tối đa ${max} ngày`)
  return { from, to }
}

async function findDays(user: CurrentUser, params: { houseId?: string; farmId?: string; from?: string; to?: string }, max: number, now: Date) {
  const houses = await resolveHouses(user, params)
  const { from, to } = resolveRange(params, max, now)
  const houseNames = new Map(houses.map(h => [String(h._id), h.name]))
  const days = await HouseHealthDay.find({ house_id: { $in: houses.map(h => h._id) }, date: { $gte: from, $lte: to } })
    .sort({ date: -1, house_id: 1 }).lean<LeanDay[]>()
  return { days, houseNames, from, to }
}

/**
 * GET /health-reports/days — ANALYTICS-FR-012, EXPERT-FR-012. `myRatingState` lọc theo trạng thái chấm của
 * chính người gọi (vd PENDING: các ngày còn phải chấm), suy ra lúc đọc nên lọc sau khi dựng.
 */
export async function listHealthDays(
  user: CurrentUser,
  params: { houseId?: string; farmId?: string; from?: string; to?: string; myRatingState?: HealthRatingState },
  now = new Date(),
) {
  const { days, houseNames } = await findDays(user, params, MAX_DAY_RANGE, now)
  const names = await userNames(days)
  const presented = days.map(d => present(d, houseNames.get(String(d.house_id)) ?? '', user, names, now))
  return params.myRatingState ? presented.filter(d => d.my_rating_state === params.myRatingState) : presented
}

async function findDayForUser(dayId: string, user: CurrentUser) {
  const day = await HouseHealthDay.findById(dayId).lean<LeanDay>()
  if (!day) throw NotFoundError('Không tìm thấy ngày đánh giá')
  const { house } = await assertHouseAccess(String(day.house_id), user)
  return { day, house }
}

/** GET /health-reports/days/:dayId */
export async function getHealthDay(dayId: string, user: CurrentUser, now = new Date()) {
  const { day, house } = await findDayForUser(dayId, user)
  return present(day, house.name, user, await userNames([day]), now)
}

/**
 * POST …/rating và …/skip — EXPERT-FR-012: lưu điểm cùng ảnh chụp trong MỘT lệnh ghi (pipeline update
 * đọc `current_*` ngay lúc ghi), rồi mới trả trạng thái. Đã chấm / đã bỏ qua / quá hạn → 409.
 */
async function submit(
  dayId: string, user: CurrentUser, input: { outcome: 'RATED' | 'SKIPPED'; rating?: HealthRatingValue; note?: string }, now: Date,
) {
  const { day, house } = await findDayForUser(dayId, user)
  const state = ratingState(day, user._id, now)
  if (state === 'EXPIRED') throw ratingClosed(`Đã quá ${RATING_WINDOW_DAYS} ngày, không chấm ngày này được nữa`)
  if (state !== 'PENDING') throw ratingClosed('Bạn đã chấm hoặc bỏ qua ngày này; chỉ thêm được ghi chú')

  const entry = {
    _id: new Types.ObjectId(),
    by: new Types.ObjectId(user._id),
    role: { $literal: user.role as FarmMemberRole },
    outcome: { $literal: input.outcome },
    ...(input.rating && { rating: { $literal: input.rating } }),
    ...(input.note && { note: { $literal: input.note } }),
    at: now,
    snapshot: {
      status: '$current_status',
      reasons: '$current_reasons',
      levels: Object.fromEntries(SOURCES.map(s => [s, { $ifNull: [`$indicators.${s}.level`, null] }])),
    },
  }
  const updated = await HouseHealthDay.findOneAndUpdate(
    { _id: day._id, 'ratings.by': { $ne: entry.by } },
    [{ $set: { ratings: { $concatArrays: [{ $ifNull: ['$ratings', []] }, [entry]] } } }],
    { new: true },
  ).lean<LeanDay>()
  // Hai request song song của cùng người: request thua không ghi đè ảnh chụp đã lưu
  if (!updated) throw ratingClosed('Bạn đã chấm hoặc bỏ qua ngày này; chỉ thêm được ghi chú')

  await logAction(user._id, input.outcome === 'RATED' ? 'HEALTH_DAY_RATED' : 'HEALTH_DAY_SKIPPED', 'house_health_day', String(day._id), {
    house_id: String(day.house_id), date: day.date, rating: input.rating,
  }, { farmId: String(day.farm_id) })
  return present(updated, house.name, user, await userNames([updated]), now)
}

export const rateHealthDay = (dayId: string, user: CurrentUser, rating: HealthRatingValue, note?: string, now = new Date()) =>
  submit(dayId, user, { outcome: 'RATED', rating, note }, now)

export const skipHealthDay = (dayId: string, user: CurrentUser, now = new Date()) =>
  submit(dayId, user, { outcome: 'SKIPPED' }, now)

/** PATCH …/rating/note — SM-18 RATED → RATED: thêm ghi chú, điểm không đổi */
export async function addRatingNote(dayId: string, user: CurrentUser, note: string, now = new Date()) {
  const { day, house } = await findDayForUser(dayId, user)
  const updated = await HouseHealthDay.findOneAndUpdate(
    { _id: day._id, ratings: { $elemMatch: { by: new Types.ObjectId(user._id), outcome: 'RATED' } } },
    { $set: { 'ratings.$.note': note } },
    { new: true },
  ).lean<LeanDay>()
  if (!updated) throw ratingClosed('Chỉ thêm ghi chú cho ngày bạn đã chấm')
  return present(updated, house.name, user, await userNames([updated]), now)
}

// ── CSV (EXPERT-FR-013) ───────────────────────────────────────────────────────────────────────────

const CSV_TEXT: Record<ReasonLang, {
  header: string[]; status: Record<string, string>; level: Record<HealthLevel, string>
  notAssessed: string; role: Record<FarmMemberRole, string>; skipped: string
}> = {
  vi: {
    header: [
      'Nhà yến', 'Ngày', 'Trạng thái chấm của bạn',
      'Môi trường (% thời gian trong ngưỡng)', 'Mức môi trường',
      'Không khí (giờ vượt ngưỡng)', 'Mức không khí',
      'Đàn chim (% tỷ lệ chim về giảm)', 'Tỷ lệ chim về (%)', 'Mức đàn chim',
      'Tiếng ồn (số đợt)', 'Mức tiếng ồn',
      'Trạng thái', 'Lý do', 'Điểm của người chấm',
      'Nhiệt độ ngoài trời thấp nhất', 'Nhiệt độ ngoài trời cao nhất', 'Lượng mưa (mm)',
    ],
    status: { GOOD: 'Tốt', WATCH: 'Theo dõi', ACTION: 'Cần xử lý', INSUFFICIENT_DATA: 'Thiếu dữ liệu' },
    level: { NORMAL: 'Bình thường', SLIGHT: 'Nhẹ', CLEAR: 'Rõ' },
    notAssessed: 'Không đánh giá',
    role: { FARM_OWNER: 'Chủ trại', DOMAIN_EXPERT: 'Chuyên gia' },
    skipped: 'Bỏ qua',
  },
  en: {
    header: [
      'House', 'Date', 'Your rating state',
      'Environment (% of time in range)', 'Environment level',
      'Air quality (hours over the limit)', 'Air quality level',
      'Flock (% drop of the return rate)', 'Return rate (%)', 'Flock level',
      'Noise (episodes)', 'Noise level',
      'Status', 'Reasons', 'Ratings',
      'Outdoor temperature min', 'Outdoor temperature max', 'Rainfall (mm)',
    ],
    status: { GOOD: 'Good', WATCH: 'Watch', ACTION: 'Action needed', INSUFFICIENT_DATA: 'Insufficient data' },
    level: { NORMAL: 'Normal', SLIGHT: 'Slight', CLEAR: 'Clear' },
    notAssessed: 'Not assessed',
    role: { FARM_OWNER: 'Farm Owner', DOMAIN_EXPERT: 'Domain Expert' },
    skipped: 'Skipped',
  },
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  // Chặn công thức khi mở bằng Excel (CSV injection)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * GET /health-reports/days.csv — 1 dòng mỗi nhà × ngày: mọi chỉ số kèm mức, trạng thái và điểm, theo
 * ngôn ngữ `lang` (mặc định vi). Không có id nội bộ; dòng người gọi còn PENDING để trống phần bị che (BR-31).
 */
export async function healthDaysCsv(
  user: CurrentUser, params: { houseId?: string; farmId?: string; from?: string; to?: string }, lang: ReasonLang = 'vi', now = new Date(),
): Promise<string> {
  const rows = await listHealthDays(user, params, now)
  const text = CSV_TEXT[lang]
  const lines = [text.header.map(csvCell).join(',')]
  for (const d of rows) {
    const shown = 'indicators' in d
    const ind = (s: HealthSource) => (shown ? d.indicators[s] : undefined)
    const level = (s: HealthSource) => {
      const l = ind(s)?.level
      return l ? text.level[l] : shown ? text.notAssessed : ''
    }
    const ratings = shown
      ? d.ratings.map(r => `${r.by.full_name ?? ''} (${text.role[r.role]}): ${r.outcome === 'SKIPPED' ? text.skipped : text.status[r.rating as string]}`).join('; ')
      : ''
    lines.push([
      d.house_name, d.date, d.my_rating_state,
      ind('environment')?.value, level('environment'),
      ind('air')?.value, level('air'),
      ind('flock')?.value, (ind('flock')?.details as { return_rate?: number } | undefined)?.return_rate, level('flock'),
      ind('noise')?.value, level('noise'),
      shown ? text.status[d.current_status] : '', shown ? d.current_reasons.map(r => formatReason(r, lang)).join('; ') : '', ratings,
      d.weather?.temperature_min, d.weather?.temperature_max, d.weather?.precipitation_mm,
    ].map(csvCell).join(','))
  }
  // BOM để Excel đọc đúng UTF-8 (tiếng Việt)
  return String.fromCharCode(0xfeff) + lines.join('\r\n') + '\r\n'
}

// ── Độ khớp (ANALYTICS-FR-014, NFR-14) ────────────────────────────────────────────────────────────

/**
 * GET /health-reports/evaluation — so ảnh chụp lúc chấm với điểm của người chấm. Ngày ảnh chụp là
 * INSUFFICIENT_DATA đếm riêng, không vào độ khớp. Ngày người gọi còn PENDING bị bỏ ra (BR-31: không lộ
 * trạng thái qua thống kê). Trả kèm từng cặp để mọi con số tính lại được.
 */
export async function evaluateRatings(
  user: CurrentUser, params: { houseId?: string; farmId?: string; from?: string; to?: string; role?: FarmMemberRole }, now = new Date(),
) {
  const { days, houseNames, from, to } = await findDays(user, params, MAX_EVALUATION_RANGE, now)
  const names = await userNames(days)
  const visible = days.filter(d => ratingState(d, user._id, now) !== 'PENDING')

  const rated = visible.flatMap(d => d.ratings
    .filter(r => r.outcome === 'RATED' && r.rating && (!params.role || r.role === params.role))
    .map(r => ({ day: d, r })))
  const insufficient = rated.filter(x => x.r.snapshot.status === 'INSUFFICIENT_DATA')
  const counted = rated.filter(x => x.r.snapshot.status !== 'INSUFFICIENT_DATA')
  const pairs: RatingPair[] = counted.map(x => ({ system: x.r.snapshot.status as OrderedStatus, rater: x.r.rating as OrderedStatus }))

  const sourceFalseAlarm = Object.fromEntries(SOURCES.map(s => [s, falseAlarmRate(counted
    .filter(x => x.r.snapshot.levels?.[s])
    .map(x => ({ predicted: LEVEL_TO_STATUS[x.r.snapshot.levels[s] as HealthLevel], rater: x.r.rating as OrderedStatus })))]))

  return {
    from, to,
    role: params.role ?? null,
    rated_count: counted.length,
    insufficient_data_count: insufficient.length,
    agreement: agreementWithCI(pairs),
    weighted_kappa: linearWeightedKappa(pairs),
    gwet_ac1: gwetAC1(pairs),
    confusion_matrix: { labels: ORDERED_STATUSES, rows: 'system', columns: 'rater', counts: confusionMatrix(pairs) },
    false_alarm_rate: {
      combined: falseAlarmRate(pairs.map(p => ({ predicted: p.system, rater: p.rater }))),
      ...sourceFalseAlarm,
    },
    ratings: rated.map(({ day, r }) => ({
      house_name: houseNames.get(String(day.house_id)) ?? '',
      date: day.date,
      assessor: { full_name: names.get(String(r.by)) ?? null, role: r.role },
      snapshot_status: r.snapshot.status,
      rating: r.rating,
      counted: r.snapshot.status !== 'INSUFFICIENT_DATA',
    })),
  }
}
