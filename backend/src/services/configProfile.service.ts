import { ConfigProfile, IConfigProfile, CONFIG_PROFILE_STAGES, type ConfigProfileStage, type SpeakerScheduleValues } from '@/models/configProfile.model'
import { CoefficientProposal } from '@/models/coefficientProposal.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { publishZoneConfig } from '@/services/deviceConfig.service'
import { logAction } from '@/services/auditLog.service'
import { notifyExpertDecision } from '@/services/expertActivity.service'
import { assertExpertDecision, findFarmOrThrow, hasFarmAccess } from '@/utils/farmAccess.util'
import { THRESHOLD_HISTORY_LIMIT } from '@/utils/thresholdUpdate.util'
import { THRESHOLD_KEYS, assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import { FUZZY_TUNING_KEYS, assertValidFuzzyTuning, pickFuzzyTuning } from '@/utils/fuzzyTuning.util'
import { DETECTION_TUNING_KEYS, assertValidDetectionTuning, pickDetectionTuning } from '@/utils/detectionTuning.util'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import type { CurrentUser, DetectionTuning, FuzzyTuning, Thresholds } from '@/types'

/**
 * EXPERT-FR-014, 015; Report 3 §6.23 — hồ sơ cấu hình của farm: Domain Expert soạn và duyệt (Farm Owner khi
 * farm chưa có chuyên gia, BR-22), Farm Owner áp cho các nhà. Áp hồ sơ là một thay đổi có lịch sử (nguồn
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

/** EXPERT-FR-014 — hồ sơ của farm, mới sửa trước */
export async function listProfiles(farmId: string, user: CurrentUser, status?: string) {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return ConfigProfile.find({ farm_id: farm._id, ...(status && { status }) }).sort({ updated_at: -1 }).lean()
}

export async function getProfile(profileId: string, user: CurrentUser) {
  return (await loadProfile(profileId, user)).profile
}

/** EXPERT-FR-014, SM-23 (new) → DRAFT */
export async function createProfile(farmId: string, user: CurrentUser, input: ProfileInput) {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  await assertExpertDecision(farm, user)
  const content = parseProfileContent(input)
  const profile = await ConfigProfile.create({ farm_id: farm._id, author_id: user._id, name: input.name, ...content })
  await logAction(user._id, 'CONFIG_PROFILE_CREATED', 'config_profile', String(profile._id), { name: profile.name }, { farmId: String(farm._id) })
  return profile
}

/** EXPERT-FR-014, SM-23 DRAFT → DRAFT: thay toàn bộ nội dung; hồ sơ đã duyệt hoặc lưu trữ không sửa được (409) */
export async function updateProfile(profileId: string, user: CurrentUser, input: ProfileInput) {
  const { profile, farm } = await loadProfile(profileId, user)
  await assertExpertDecision(farm, user)
  assertStatus(profile, 'DRAFT', 'sửa')
  const content = parseProfileContent(input)
  profile.set({ name: input.name ?? profile.name, thresholds: undefined, fuzzy_tuning: undefined, detection_tuning: undefined, speaker_schedule: undefined, ...content })
  await profile.save()
  await logAction(user._id, 'CONFIG_PROFILE_UPDATED', 'config_profile', String(profile._id), { name: profile.name }, { farmId: String(farm._id) })
  return profile
}

/** EXPERT-FR-014, SM-23 DRAFT → APPROVED; báo Farm Owner (EXPERT-FR-009) */
export async function approveProfile(profileId: string, user: CurrentUser) {
  const { profile, farm } = await loadProfile(profileId, user)
  await assertExpertDecision(farm, user)
  assertStatus(profile, 'DRAFT', 'duyệt')
  profile.set({ status: 'APPROVED', approved_by: user._id, approved_at: new Date() })
  await profile.save()
  const auditId = await logAction(user._id, 'CONFIG_PROFILE_APPROVED', 'config_profile', String(profile._id), { name: profile.name }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, { what: 'duyệt hồ sơ cấu hình', place: `Hồ sơ "${profile.name}"` })
  return profile
}

/** EXPERT-FR-014, SM-23 APPROVED → ARCHIVED; áp hồ sơ đã lưu trữ thì 409 */
export async function archiveProfile(profileId: string, user: CurrentUser) {
  const { profile, farm } = await loadProfile(profileId, user)
  await assertExpertDecision(farm, user)
  assertStatus(profile, 'APPROVED', 'lưu trữ')
  profile.set({ status: 'ARCHIVED', archived_at: new Date() })
  await profile.save()
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
