import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expertApi } from '@/services/api/expert.api'
import type { ProposalStatus, ReviewItemStatus } from '@/types'

/**
 * Hook lấy danh sách yêu cầu review thay đổi tham số của Chủ trại (EXPERT-FR-010, SRS §6.10)
 */
export function useExpertReviewItems(params?: {
  farm_id?: string
  zone_id?: string
  status?: ReviewItemStatus
}) {
  return useQuery({
    queryKey: ['expert', 'review-items', params],
    queryFn: () => expertApi.getReviewItems(params).then(res => res.data),
    enabled: Boolean(params?.farm_id),
  })
}

/**
 * Hook xử lý hành động review thay đổi của Chủ trại (ACCEPT hoặc REVERT — theo api-spec.yaml)
 */
export function useTakeReviewAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      itemId,
      action,
    }: {
      itemId: string
      action: 'ACCEPT' | 'REVERT'
    }) => expertApi.takeReviewAction(itemId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert', 'review-items'] })
      queryClient.invalidateQueries({ queryKey: ['expert', 'zone-tuning'] })
      queryClient.invalidateQueries({ queryKey: ['expert', 'activity'] })
    },
  })
}

/**
 * Hook lấy danh sách đề xuất hệ số mờ Fuzzy cần Chuyên gia phê duyệt (EXPERT-FR-011, SRS §6.11)
 */
export function useExpertProposals(params?: {
  farm_id?: string
  zone_id?: string
  status?: ProposalStatus
}) {
  return useQuery({
    queryKey: ['expert', 'proposals', params],
    queryFn: () => expertApi.getProposals(params).then(res => res.data),
    enabled: Boolean(params?.farm_id),
  })
}

/**
 * Hook xử lý phê duyệt hoặc từ chối đề xuất hệ số mờ (APPROVE hoặc REJECT)
 */
export function useTakeProposalAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      proposalId,
      action,
      rejectionReason,
    }: {
      proposalId: string
      action: 'APPROVE' | 'REJECT'
      rejectionReason?: string
    }) => expertApi.takeProposalAction(proposalId, action, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expert', 'proposals'] })
      queryClient.invalidateQueries({ queryKey: ['expert', 'zone-tuning'] })
      queryClient.invalidateQueries({ queryKey: ['expert', 'activity'] })
    },
  })
}
