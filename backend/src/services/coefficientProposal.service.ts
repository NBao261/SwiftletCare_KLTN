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

/** Không có gợi ý thì 409 kèm lý do */
async function currentSuggestion(user: CurrentUser, zoneId: string) {
  const result = await getTuningSuggestion(user, zoneId)
  if (!result.suggestion) throw ConflictError(result.reason ?? 'Hiện chưa có gợi ý hệ số cho khu vực này')
  return result as typeof result & { suggestion: NonNullable<typeof result.suggestion> }
}

const SUBMIT_ATTEMPTS = 3

/** Chụp giá trị lúc gửi. Farm chưa có chuyên gia thì 409 (Farm Owner áp trực tiếp) */
export async function submitProposal(user: CurrentUser, zoneId: string): Promise<ICoefficientProposal> {
  const { zone, farm } = await assertZoneAccess(zoneId, user)
  if (user.role !== 'FARM_OWNER') throw ForbiddenError('Chỉ Farm Owner gửi đề xuất cho chuyên gia')
  if (!(await farmHasActiveExpert(farm))) {
    throw ConflictError('Farm chưa có chuyên gia — Farm Owner áp gợi ý trực tiếp (POST /farms/zones/{zoneId}/fuzzy-tuning/apply-suggestion)')
  }
  const { suggestion, predicted } = await currentSuggestion(user, zoneId)

  // Unique index: lần tạo sau gặp E11000, chạy lại để đề xuất mới nhất thắng
  let proposal: ICoefficientProposal | undefined
  for (let attempt = 1; !proposal; attempt++) {
    await CoefficientProposal.updateMany({ zone_id: zone._id, status: 'PROPOSED' }, { status: 'SUPERSEDED' })
    try {
      proposal = await CoefficientProposal.create({
        zone_id: zone._id, farm_id: farm._id, submitted_by: user._id,
        suggested_values: suggestion, current_values: zone.toObject().fuzzy_tuning, predicted,
      })
    } catch (err) {
      if ((err as { code?: number }).code !== 11000 || attempt >= SUBMIT_ATTEMPTS) throw err
    }
  }
  await logAction(user._id, 'PROPOSAL_SUBMITTED', 'coefficient_proposal', String(proposal._id), {
    zone_id: String(zone._id), house_id: String(zone.house_id), suggested: suggestion,
  }, { farmId: String(farm._id) })
  await notifyExpertsOfProposal(farm._id, user, zone.name, String(proposal._id))
  return proposal
}

async function notifyExpertsOfProposal(farmId: unknown, owner: CurrentUser, zoneName: string, proposalId: string) {
  try {
    const [experts, author] = await Promise.all([findFarmExperts(farmId), User.findById(owner._id).select('full_name').lean()])
    await Promise.all(experts.map(expertId => createInAppNotification(expertId, {
      title: `Cần duyệt: ${author?.full_name ?? owner.email} đề xuất hệ số điều khiển mờ`,
      body: `Zone "${zoneName}": gợi ý của hệ thống chờ chuyên gia duyệt hoặc từ chối.`,
      ref: { kind: 'coefficient_proposal', id: proposalId },
    })))
  } catch (err) {
    logger.warn('Báo chuyên gia về đề xuất hệ số thất bại', { err, proposalId })
  }
}

async function loadPendingProposal(proposalId: string, user: CurrentUser) {
  const proposal = await CoefficientProposal.findById(proposalId)
  if (!proposal) throw NotFoundError('Không tìm thấy đề xuất')
  const chain = await assertZoneAccess(String(proposal.zone_id), user)
  if (user.role !== 'DOMAIN_EXPERT') throw ForbiddenError('Chỉ Domain Expert duyệt đề xuất hệ số')
  if (proposal.status !== 'PROPOSED') throw ConflictError('Đề xuất này đã đóng')
  return { proposal, chain }
}

/** Có điều kiện: 2 thao tác cùng lúc chỉ 1 cái thành công */
async function closeProposal(proposal: ICoefficientProposal, user: CurrentUser, status: CoefficientProposalStatus, note?: string) {
  const closed = await CoefficientProposal.findOneAndUpdate(
    { _id: proposal._id, status: 'PROPOSED' },
    { status, decided_by: user._id, decided_at: new Date(), ...(note && { note }) },
    { new: true },
  )
  if (!closed) throw ConflictError('Đề xuất này đã đóng')
  return closed
}

export async function approveProposal(proposalId: string, user: CurrentUser): Promise<ICoefficientProposal> {
  const { proposal, chain } = await loadPendingProposal(proposalId, user)
  const suggested = pickFuzzyTuning(proposal.suggested_values)
  const before = chain.zone.toObject().fuzzy_tuning
  assertValidFuzzyTuning({ ...before, ...suggested })

  // Đóng trước rồi mới áp: 2 chuyên gia cùng duyệt chỉ 1 người áp. Áp lỗi thì về PROPOSED
  const closed = await closeProposal(proposal, user, 'APPROVED')
  try {
    // Lịch sử chỉ hiện PROPOSAL_APPROVED
    await applyFuzzyTuning(chain, user, suggested, 'SUGGESTION_APPROVED', { notify: false, logDetails: { decided_in: 'coefficient_proposal' } })
  } catch (err) {
    await CoefficientProposal.updateOne(
      { _id: proposal._id, status: 'APPROVED' },
      { status: 'PROPOSED', $unset: { decided_by: 1, decided_at: 1 } },
    ).catch((reopenErr: Error) => logger.warn('Mở lại đề xuất sau khi áp lỗi thất bại', { err: reopenErr, proposalId }))
    throw err
  }

  const auditId = await logAction(user._id, 'PROPOSAL_APPROVED', 'coefficient_proposal', String(proposal._id), {
    zone_id: String(chain.zone._id), house_id: String(chain.house._id), before, after: { ...before, ...suggested },
  }, { farmId: String(chain.farm._id) })
  await notifyExpertDecision(user, chain.farm._id, auditId, {
    what: 'duyệt đề xuất hệ số điều khiển mờ', place: `Zone "${chain.zone.name}"`,
    detail: formatChanges(before, { ...before, ...suggested }),
  })
  return closed
}

/** Lý do bắt buộc (422 ở route) */
export async function rejectProposal(proposalId: string, user: CurrentUser, note: string): Promise<ICoefficientProposal> {
  const { proposal, chain } = await loadPendingProposal(proposalId, user)
  const closed = await closeProposal(proposal, user, 'REJECTED', note.trim())

  const auditId = await logAction(user._id, 'PROPOSAL_REJECTED', 'coefficient_proposal', String(proposal._id), {
    zone_id: String(chain.zone._id), house_id: String(chain.house._id), note: note.trim(),
  }, { farmId: String(chain.farm._id) })
  await notifyExpertDecision(user, chain.farm._id, auditId, {
    what: 'từ chối đề xuất hệ số điều khiển mờ', place: `Zone "${chain.zone.name}"`, detail: note.trim(),
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

/** Farm có chuyên gia thì Farm Owner bị 403, phải gửi đề xuất */
export async function applySuggestionDirect(user: CurrentUser, zoneId: string) {
  const chain = await assertZoneAccess(zoneId, user)
  await assertExpertDecision(chain.farm, user)
  const { suggestion } = await currentSuggestion(user, zoneId)
  return applyFuzzyTuning(chain, user, pickFuzzyTuning(suggestion), 'SUGGESTION_APPROVED')
}
