import { ConfigProfile, IConfigProfile, CONFIG_PROFILE_STAGES, type ConfigProfileStage, type SpeakerScheduleValues } from '@/models/configProfile.model'
import { CoefficientProposal } from '@/models/coefficientProposal.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { publishZoneConfig } from '@/services/deviceConfig.service'
import { logAction } from '@/services/auditLog.service'
import { notifyExpertDecision } from '@/services/expertActivity.service'
import { notifyExpertsOfProposal } from '@/services/notification.service'
import { findFarmOrThrow, hasFarmAccess } from '@/utils/farmAccess.util'
import { paginate } from '@/utils/helpers.util'
import { THRESHOLD_HISTORY_LIMIT } from '@/utils/thresholdUpdate.util'
import { THRESHOLD_KEYS, assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import { FUZZY_TUNING_KEYS, assertValidFuzzyTuning, pickFuzzyTuning } from '@/utils/fuzzyTuning.util'
import { DETECTION_TUNING_KEYS, assertValidDetectionTuning, pickDetectionTuning } from '@/utils/detectionTuning.util'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import type { CurrentUser, DetectionTuning, FuzzyTuning, Thresholds } from '@/types'

/**
 * EXPERT-FR-014, 015; Report 3 §6.23 — hồ sơ cấu hình của farm: Domain Expert và Farm Owner soạn bản nháp, chỉ Domain
 * Expert duyệt (BR-22), Farm Owner áp cho các nhà. Áp hồ sơ là một thay đổi có lịch sử (nguồn
 * `PROFILE`) và một phiên bản cấu hình mới cho mỗi zone (ENV-FR-027); hồ sơ đã được chuyên gia duyệt nên
 * không mở mục duyệt EXPERT-FR-010.
 */

export interface ProfileInput {
  name?: string
  stage?: string | null
  thresholds?: Record<string, unknown> | null
  fuzzy_tuning?: Record<string, unknown> | null
  detection_tuning?: Record<string, unknown> | null
  speaker_schedule?: { enabled?: unknown; windows?: unknown } | null
}

interface ProfileContent {
  stage: ConfigProfileStage | null
  thresholds?: Thresholds
  fuzzy_tuning?: FuzzyTuning
  detection_tuning?: DetectionTuning
  speaker_schedule?: SpeakerScheduleValues
}

const HOUR_START = /^([01]\d|2[0-3]):00$/
const HOUR_END = /^(([01]\d|2[0-3]):00|24:00)$/

function assertComplete(group: string, picked: object, keys: readonly string[]): void {
  const missing = keys.filter(key => !(key in picked))
  if (missing.length) throw BadRequestError(`${group}: thiếu ${missing.join(', ')} — nhóm đã có trong hồ sơ phải đủ mọi giá trị`)
}

/** ENV-FR-013b, BR-07 — cùng luật với PUT …/speaker-schedule: 1–2 khung giờ tròn, bắt đầu trước kết thúc */
function parseSpeakerSchedule(input: { enabled?: unknown; windows?: unknown }): SpeakerScheduleValues {
  if (typeof input.enabled !== 'boolean') throw BadRequestError('speaker_schedule.enabled phải là true/false')
  const windows = input.windows
  if (!Array.isArray(windows) || windows.length < 1 || windows.length > 2) {
    throw BadRequestError('speaker_schedule.windows phải có 1-2 khung giờ')
  }
  return {
    enabled: input.enabled,
    windows: windows.map((w: { start?: unknown; end?: unknown }) => {
      const start = String(w?.start ?? '')
      const end = String(w?.end ?? '')
      if (!HOUR_START.test(start) || !HOUR_END.test(end) || start >= end) {
        throw BadRequestError(`Khung giờ loa ${start}-${end} không hợp lệ: giờ tròn, bắt đầu trước kết thúc`)
      }
      return { start, end }
    }),
  }
}

/** EXPERT-FR-014 — 400 khi giá trị ngoài khoảng, nhóm thiếu khoá hoặc hồ sơ rỗng */
export function parseProfileContent(input: ProfileInput): ProfileContent {
  const stage = input.stage ?? null
  if (stage !== null && !CONFIG_PROFILE_STAGES.includes(stage as ConfigProfileStage)) {
    throw BadRequestError('stage phải là ATTRACTING, OCCUPIED hoặc để trống')
  }
  const content: ProfileContent = { stage: stage as ConfigProfileStage | null }
  if (input.thresholds) {
    const t = pickThresholds(input.thresholds)
    assertComplete('thresholds', t, THRESHOLD_KEYS)
    assertValidThresholds(t as Thresholds)
    content.thresholds = t as Thresholds
  }
  if (input.fuzzy_tuning) {
    const f = pickFuzzyTuning(input.fuzzy_tuning)
    assertComplete('fuzzy_tuning', f, [...FUZZY_TUNING_KEYS, 'fuzzy_input_filter'])
    assertValidFuzzyTuning(f as FuzzyTuning)
    content.fuzzy_tuning = f as FuzzyTuning
  }
  if (input.detection_tuning) {
    const d = pickDetectionTuning(input.detection_tuning)
    assertComplete('detection_tuning', d, DETECTION_TUNING_KEYS)
    assertValidDetectionTuning(d as DetectionTuning)
    content.detection_tuning = d as DetectionTuning
  }
  if (input.speaker_schedule) content.speaker_schedule = parseSpeakerSchedule(input.speaker_schedule)
  if (!content.thresholds && !content.fuzzy_tuning && !content.detection_tuning && !content.speaker_schedule) {
    throw BadRequestError('Hồ sơ cần ít nhất một nhóm: ngưỡng, hệ số mờ, tham số phát hiện hoặc lịch loa')
  }
  return content
}

async function loadProfile(profileId: string, user: CurrentUser) {
  const profile = await ConfigProfile.findById(profileId)
  if (!profile) throw NotFoundError('Không tìm thấy hồ sơ cấu hình')
  const farm = await findFarmOrThrow(String(profile.farm_id))
  // Farm Owner và Domain Expert của farm (Report 3 §2.4); Farm Technician, Administrator đã bị chặn ở route
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return { profile, farm }
}

function assertStatus(profile: IConfigProfile, expected: IConfigProfile['status'], action: string): void {
  if (profile.status !== expected) throw ConflictError(`Hồ sơ đang ${profile.status}, không thể ${action}`)
}

/** EXPERT-FR-014 — hồ sơ của farm, mới sửa trước, phân trang như mọi danh sách (backend/CLAUDE.md) */
export async function listProfiles(
  farmId: string, user: CurrentUser, query: { status?: string; page?: string; limit?: string } = {},
) {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  const filter = { farm_id: farm._id, ...(query.status && { status: query.status }) }
  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    ConfigProfile.find(filter).sort({ updated_at: -1 }).skip(skip).limit(limit).lean(),
    ConfigProfile.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

export async function getProfile(profileId: string, user: CurrentUser) {
  return (await loadProfile(profileId, user)).profile
}

/** EXPERT-FR-014, SM-23 (new) → DRAFT; Farm Owner soạn thì báo chuyên gia của farm để duyệt (BR-22) */
export async function createProfile(farmId: string, user: CurrentUser, input: ProfileInput) {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  const content = parseProfileContent(input)
  const profile = await ConfigProfile.create({ farm_id: farm._id, author_id: user._id, name: input.name, ...content })
  await logAction(user._id, 'CONFIG_PROFILE_CREATED', 'config_profile', String(profile._id), { name: profile.name }, { farmId: String(farm._id) })
  if (user.role === 'FARM_OWNER') {
    await notifyExpertsOfProposal(farm._id, user, {
      what: `soạn hồ sơ cấu hình "${profile.name}"`, body: 'Hồ sơ chỉ áp được khi chuyên gia duyệt.',
      ref: { kind: 'config_profile', id: String(profile._id) },
    })
  }
  return profile
}

/**
 * EXPERT-FR-014, SM-23 DRAFT → DRAFT: thay toàn bộ nội dung trong một lệnh ghi có điều kiện (chuyên gia vừa duyệt thì
 * 409, không ghi đè hồ sơ đã duyệt); Farm Owner sửa thì báo chuyên gia để duyệt đúng bản mới (BR-22)
 */
export async function updateProfile(profileId: string, user: CurrentUser, input: ProfileInput) {
  const { profile, farm } = await loadProfile(profileId, user)
  assertStatus(profile, 'DRAFT', 'sửa')
  const content = parseProfileContent(input)
  // Nhóm không gửi thì bỏ khỏi hồ sơ
  const removed = ['thresholds', 'fuzzy_tuning', 'detection_tuning', 'speaker_schedule'].filter(key => !(key in content))
  const updated = await ConfigProfile.findOneAndUpdate(
    { _id: profile._id, status: 'DRAFT' },
    {
      $set: { name: input.name ?? profile.name, ...content },
      ...(removed.length > 0 && { $unset: Object.fromEntries(removed.map(key => [key, 1])) }),
    },
    { new: true },
  )
  if (!updated) throw ConflictError('Hồ sơ vừa đổi trạng thái, không thể sửa')
  await logAction(user._id, 'CONFIG_PROFILE_UPDATED', 'config_profile', String(updated._id), { name: updated.name }, { farmId: String(farm._id) })
  if (user.role === 'FARM_OWNER') {
    await notifyExpertsOfProposal(farm._id, user, {
      what: `sửa hồ sơ cấu hình "${updated.name}"`, body: 'Hồ sơ chỉ áp được khi chuyên gia duyệt.',
      ref: { kind: 'config_profile', id: String(updated._id) },
    })
  }
  return updated
}

/**
 * Chuyển trạng thái trong một lần ghi có điều kiện: hai request cùng lúc thì request sau nhận 409, không có hai
 * audit và hai thông báo cho cùng một lần duyệt
 */
async function transition(profile: IConfigProfile, from: IConfigProfile['status'], set: Partial<IConfigProfile>, action: string) {
  assertStatus(profile, from, action)
  const updated = await ConfigProfile.findOneAndUpdate({ _id: profile._id, status: from }, set, { new: true })
  if (!updated) throw ConflictError(`Hồ sơ vừa đổi trạng thái, không thể ${action}`)
  return updated
}

/** EXPERT-FR-014, SM-23 DRAFT → APPROVED; báo Farm Owner (EXPERT-FR-009) */
export async function approveProfile(profileId: string, user: CurrentUser) {
  const { profile: current, farm } = await loadProfile(profileId, user)
  const profile = await transition(current, 'DRAFT', { status: 'APPROVED', approved_by: user._id as never, approved_at: new Date() }, 'duyệt')
  const auditId = await logAction(user._id, 'CONFIG_PROFILE_APPROVED', 'config_profile', String(profile._id), { name: profile.name }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, { what: 'duyệt hồ sơ cấu hình', place: `Hồ sơ "${profile.name}"` })
  return profile
}

/** EXPERT-FR-014, SM-23 APPROVED → ARCHIVED; áp hồ sơ đã lưu trữ thì 409 */
export async function archiveProfile(profileId: string, user: CurrentUser) {
  const { profile: current, farm } = await loadProfile(profileId, user)
  const profile = await transition(current, 'APPROVED', { status: 'ARCHIVED', archived_at: new Date() }, 'lưu trữ')
  await logAction(user._id, 'CONFIG_PROFILE_ARCHIVED', 'config_profile', String(profile._id), { name: profile.name }, { farmId: String(farm._id) })
  return profile
}

const historyEntry = (user: CurrentUser, at: Date, oldValues: object, newValues: object) => ({
  changed_by: user._id, changed_by_role: user.role, changed_at: at, old_values: oldValues, new_values: newValues, source: 'PROFILE',
})

/**
 * EXPERT-FR-015 — Farm Owner áp hồ sơ APPROVED cho các nhà của farm: mỗi zone nhận các nhóm của hồ sơ với lịch
 * sử nguồn `PROFILE`, lịch loa chép vào mọi controller của zone, rồi một phiên bản cấu hình mới (publishZoneConfig).
 * Hồ sơ DRAFT hoặc ARCHIVED → 409; nhà ngoài farm của hồ sơ → 400.
 */
export async function applyProfile(profileId: string, user: CurrentUser, houseIds: string[]) {
  const { profile, farm } = await loadProfile(profileId, user)
  if (profile.status !== 'APPROVED') throw ConflictError(`Chỉ áp được hồ sơ đã duyệt (hồ sơ đang ${profile.status})`)
  const uniqueIds = [...new Set(houseIds)]
  const houses = await House.find({ _id: { $in: uniqueIds }, farm_id: farm._id }).select('_id name').lean()
  if (houses.length !== uniqueIds.length) throw BadRequestError('Có nhà không thuộc farm của hồ sơ')

  const content = profile.toObject() as IConfigProfile
  const zones = await Zone.find({ house_id: { $in: houses.map(h => h._id) } })
  const now = new Date()
  for (const zone of zones) {
    if (content.thresholds) {
      zone.threshold_history.push(historyEntry(user, now, { ...zone.thresholds }, content.thresholds) as never)
      zone.thresholds = content.thresholds
    }
    if (content.fuzzy_tuning) {
      zone.fuzzy_tuning_history.push(historyEntry(user, now, { ...zone.fuzzy_tuning }, content.fuzzy_tuning) as never)
      zone.fuzzy_tuning = content.fuzzy_tuning
    }
    if (content.detection_tuning) {
      zone.detection_tuning_history.push(historyEntry(user, now, { ...zone.detection_tuning }, content.detection_tuning) as never)
      zone.detection_tuning = content.detection_tuning
    }
    for (const history of [zone.threshold_history, zone.fuzzy_tuning_history, zone.detection_tuning_history]) {
      const overflow = history.length - THRESHOLD_HISTORY_LIMIT
      if (overflow > 0) history.splice(0, overflow)
    }
    await zone.save()
    // EXPERT-FR-010 — mục duyệt đang chờ của Farm Owner không còn khớp giá trị của zone: đóng như khi chuyên gia tự
    // sửa (ADJUSTED), để "hoàn lại" về sau không ghi giá trị cũ đè lên hồ sơ chuyên gia đã duyệt
    const reviewedGroups = [
      content.thresholds && 'thresholds', content.fuzzy_tuning && 'fuzzy', content.detection_tuning && 'detection',
    ].filter(Boolean)
    if (reviewedGroups.length) {
      await ParameterReview.updateMany(
        { target_id: zone._id, group: { $in: reviewedGroups }, status: 'PENDING_REVIEW' },
        { status: 'ADJUSTED', reviewed_by: user._id, reviewed_at: now },
      )
    }
    if (content.speaker_schedule) {
      await SensorNode.updateMany({ zone_id: zone._id, ...IN_SERVICE }, { speaker_schedule: content.speaker_schedule })
    }
    // Đề xuất hệ số đang chờ không còn khớp hệ số mới (cùng lý do như applyFuzzyTuning, EXPERT-FR-011)
    if (content.fuzzy_tuning) await CoefficientProposal.updateMany({ zone_id: zone._id, status: 'PROPOSED' }, { status: 'SUPERSEDED' })
    await publishZoneConfig(zone._id)
  }

  profile.applications.push({ house_ids: houses.map(h => h._id), zone_count: zones.length, applied_by: user._id as never, applied_at: now })
  await profile.save()
  await logAction(user._id, 'CONFIG_PROFILE_APPLIED', 'config_profile', String(profile._id), {
    name: profile.name, house_ids: houses.map(h => String(h._id)), zone_ids: zones.map(z => String(z._id)),
  }, { farmId: String(farm._id) })

  const versions = await Zone.find({ _id: { $in: zones.map(z => z._id) } }).select('house_id name config_version').lean()
  return {
    profile_id: String(profile._id),
    zones: versions.map(z => ({ zone_id: String(z._id), house_id: String(z.house_id), name: z.name, config_version: z.config_version })),
  }
}
