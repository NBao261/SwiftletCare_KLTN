import { CoefficientProposal, ICoefficientProposal, type CoefficientProposalStatus } from '@/models/coefficientProposal.model'
import { User } from '@/models/user.model'
import { logAction } from '@/services/auditLog.service'
import { formatChanges, notifyExpertDecision } from '@/services/expertActivity.service'
import { applyFuzzyTuning } from '@/services/farm.service'
import { createInAppNotification, findFarmExperts } from '@/services/notification.service'
import { getTuningSuggestion } from '@/services/tuningSuggestion.service'
import { assertExpertDecision, assertFarmAccess, assertZoneAccess, farmHasActiveExpert } from '@/utils/farmAccess.util'
import { assertValidFuzzyTuning, pickFuzzyTuning } from '@/utils/fuzzyTuning.util'
import { paginate } from '@/utils/helpers.util'
import { ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

/** Gợi ý hiện tại của Zone (ANALYTICS-FR-010); không có gợi ý thì 409 kèm lý do của mô hình */
async function currentSuggestion(user: CurrentUser, zoneId: string) {
  const result = await getTuningSuggestion(user, zoneId)
  if (!result.suggestion) throw ConflictError(result.reason ?? 'Hiện chưa có gợi ý hệ số cho khu vực này')
  return result as typeof result & { suggestion: NonNullable<typeof result.suggestion> }
}

/**
 * EXPERT-FR-011 — Farm Owner gửi gợi ý hiện tại của hệ thống cho chuyên gia. Chụp gợi ý và hệ số
 * đang dùng lúc gửi; đề xuất cũ còn chờ của Zone thành SUPERSEDED; báo Domain Expert trong ứng dụng
 * (EXPERT-FR-007). Farm chưa có chuyên gia thì Farm Owner áp trực tiếp (BR-22) — gửi bị 409.
 */
export async function submitProposal(user: CurrentUser, zoneId: string): Promise<ICoefficientProposal> {
  const { zone, farm } = await assertZoneAccess(zoneId, user)
  if (user.role !== 'FARM_OWNER') throw ForbiddenError('Chỉ Farm Owner gửi đề xuất cho chuyên gia')
  if (!(await farmHasActiveExpert(farm))) {
    throw ConflictError('Farm chưa có chuyên gia — Farm Owner áp gợi ý trực tiếp (POST /farms/zones/{zoneId}/fuzzy-tuning/apply-suggestion)')
  }
  const { suggestion, predicted } = await currentSuggestion(user, zoneId)

  await CoefficientProposal.updateMany({ zone_id: zone._id, status: 'PROPOSED' }, { status: 'SUPERSEDED' })
  const proposal = await CoefficientProposal.create({
    zone_id: zone._id, farm_id: farm._id, submitted_by: user._id,
    suggested_values: suggestion, current_values: zone.toObject().fuzzy_tuning, predicted,
  })
  await logAction(user._id, 'PROPOSAL_SUBMITTED', 'coefficient_proposal', String(proposal._id), {
    zone_id: String(zone._id), house_id: String(zone.house_id), suggested: suggestion,
  }, { farmId: String(farm._id) })
  await notifyExpertsOfProposal(farm._id, user, zone.name, String(proposal._id))
  return proposal
}

/** EXPERT-FR-007 — đề xuất mới chỉ báo trong ứng dụng cho Domain Expert của farm */
async function notifyExpertsOfProposal(farmId: unknown, owner: CurrentUser, zoneName: string, proposalId: string) {
  try {
    const [experts, author] = await Promise.all([findFarmExperts(farmId), User.findById(owner._id).select('full_name').lean()])
    await Promise.all(experts.map(expertId => createInAppNotification(expertId, {
      title: `Cần duyệt: ${author?.full_name ?? owner.email} đề xuất hệ số điều khiển mờ`,
      body: `Khu vực "${zoneName}" — gợi ý của hệ thống chờ chuyên gia duyệt hoặc từ chối.`,
      ref: { kind: 'coefficient_proposal', id: proposalId },
    })))
  } catch (err) {
    logger.warn('Báo chuyên gia về đề xuất hệ số thất bại', { err, proposalId })
  }
}

/** Đề xuất + Zone của nó, đã kiểm: Domain Expert của farm, đề xuất còn chờ (Report 3 §6.11) */
async function loadPendingProposal(proposalId: string, user: CurrentUser) {
  const proposal = await CoefficientProposal.findById(proposalId)
  if (!proposal) throw NotFoundError('Không tìm thấy đề xuất')
  const chain = await assertZoneAccess(String(proposal.zone_id), user)
  if (user.role !== 'DOMAIN_EXPERT') throw ForbiddenError('Chỉ Domain Expert duyệt đề xuất hệ số')
  if (proposal.status !== 'PROPOSED') throw ConflictError('Đề xuất này đã đóng')
  return { proposal, chain }
}

/** Đóng đề xuất còn chờ — có điều kiện để 2 thao tác cùng lúc chỉ 1 cái thành công */
async function closeProposal(proposal: ICoefficientProposal, user: CurrentUser, status: CoefficientProposalStatus, note?: string) {
  const closed = await CoefficientProposal.findOneAndUpdate(
    { _id: proposal._id, status: 'PROPOSED' },
    { status, decided_by: user._id, decided_at: new Date(), ...(note && { note }) },
    { new: true },
  )
  if (!closed) throw ConflictError('Đề xuất này đã đóng')
  return closed
}

/**
 * EXPERT-FR-011 — chuyên gia duyệt: áp hệ số đã chụp lúc gửi như ENV-FR-021 (lịch sử
 * SUGGESTION_APPROVED, gửi xuống ESP32); PROPOSED → APPROVED; báo Farm Owner.
 */
export async function approveProposal(proposalId: string, user: CurrentUser): Promise<ICoefficientProposal> {
  const { proposal, chain } = await loadPendingProposal(proposalId, user)
  const suggested = pickFuzzyTuning(proposal.suggested_values)
  const before = chain.zone.toObject().fuzzy_tuning
  assertValidFuzzyTuning({ ...before, ...suggested })

  // Đóng trước rồi mới áp: applyFuzzyTuning chuyển mọi đề xuất PROPOSED của Zone thành SUPERSEDED
  const closed = await closeProposal(proposal, user, 'APPROVED')
  await applyFuzzyTuning(chain, user, suggested, 'SUGGESTION_APPROVED', { notify: false })

  const auditId = await logAction(user._id, 'PROPOSAL_APPROVED', 'coefficient_proposal', String(proposal._id), {
    zone_id: String(chain.zone._id), house_id: String(chain.house._id), before, after: { ...before, ...suggested },
  }, { farmId: String(chain.farm._id) })
  await notifyExpertDecision(user, chain.farm._id, auditId, {
    what: 'duyệt đề xuất hệ số điều khiển mờ', place: `Khu vực "${chain.zone.name}"`,
    detail: formatChanges(before, { ...before, ...suggested }),
  })
  return closed
}

/** EXPERT-FR-011 — chuyên gia từ chối kèm lý do (bắt buộc, 422 ở route): PROPOSED → REJECTED, báo Farm Owner */
export async function rejectProposal(proposalId: string, user: CurrentUser, note: string): Promise<ICoefficientProposal> {
  const { proposal, chain } = await loadPendingProposal(proposalId, user)
  const closed = await closeProposal(proposal, user, 'REJECTED', note.trim())

  const auditId = await logAction(user._id, 'PROPOSAL_REJECTED', 'coefficient_proposal', String(proposal._id), {
    zone_id: String(chain.zone._id), house_id: String(chain.house._id), note: note.trim(),
  }, { farmId: String(chain.farm._id) })
  await notifyExpertDecision(user, chain.farm._id, auditId, {
    what: 'từ chối đề xuất hệ số điều khiển mờ', place: `Khu vực "${chain.zone.name}"`, detail: note.trim(),
  })
  return closed
}

export interface ListProposalsQuery {
  farmId: string
  zoneId?: string
  status?: CoefficientProposalStatus
  page?: string | number
  limit?: string | number
}

/** EXPERT-FR-011 — đề xuất của 1 farm, mới nhất trước; chỉ Farm Owner và Domain Expert của farm */
export async function listProposals(user: CurrentUser, query: ListProposalsQuery) {
  const farm = await assertFarmAccess(query.farmId, user)
  const filter = {
    farm_id: farm._id,
    ...(query.zoneId && { zone_id: query.zoneId }),
    ...(query.status && { status: query.status }),
  }
  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    CoefficientProposal.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    CoefficientProposal.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

/**
 * EXPERT-FR-011, BR-22 — áp gợi ý hiện tại trực tiếp: Domain Expert luôn được; Farm Owner chỉ khi farm
 * chưa có chuyên gia (có chuyên gia → 403, hệ số giữ nguyên — phải gửi đề xuất). Lịch sử
 * SUGGESTION_APPROVED; đề xuất còn chờ của Zone thành SUPERSEDED.
 */
export async function applySuggestionDirect(user: CurrentUser, zoneId: string) {
  const chain = await assertZoneAccess(zoneId, user)
  await assertExpertDecision(chain.farm, user)
  const { suggestion } = await currentSuggestion(user, zoneId)
  await CoefficientProposal.updateMany({ zone_id: chain.zone._id, status: 'PROPOSED' }, { status: 'SUPERSEDED' })
  return applyFuzzyTuning(chain, user, pickFuzzyTuning(suggestion), 'SUGGESTION_APPROVED')
}
