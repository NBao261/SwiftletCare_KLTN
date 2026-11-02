import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '@/apis/domain-expert/reviews.api';
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery';
import type {
  ParameterReview,
  CoefficientProposal,
  ParameterReviewsQueryParams,
  CoefficientProposalsQueryParams,
} from '@/types/expert/reviews.types';

// Query key đồng bộ cho mục duyệt tham số
export const REVIEWS_QUERY_KEY = (parameters: Partial<ParameterReviewsQueryParams>) => [
  'expert',
  'reviews',
  parameters.farmId,
  parameters.zoneId,
  parameters.status,
  parameters.page,
];

// Query key đồng bộ cho đề xuất hệ số mờ
export const PROPOSALS_QUERY_KEY = (parameters: Partial<CoefficientProposalsQueryParams>) => [
  'expert',
  'proposals',
  parameters.farmId,
  parameters.zoneId,
  parameters.status,
  parameters.page,
];

// Hook danh sách phân trang mục duyệt tham số (EXPERT-FR-010)
export function useParameterReviews(
  parameters: ParameterReviewsQueryParams,
  options?: { enabled?: boolean },
) {
  return usePaginatedListQuery<ParameterReview>(
    REVIEWS_QUERY_KEY(parameters),
    () => reviewsApi.listReviews(parameters),
    parameters.page ?? 1,
    parameters.limit ?? 20,
    { enabled: Boolean(parameters.farmId) && (options?.enabled ?? true), staleTime: 30_000 },
  );
}

// Chuyên gia chấp thuận thay đổi tham số của Farm Owner
export function useAcceptParameterReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => reviewsApi.acceptReview(reviewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['expert', 'activity'] });
    },
  });
}

// Chuyên gia hoàn nguyên tham số về giá trị ban đầu
export function useRevertParameterReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => reviewsApi.revertReview(reviewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['expert', 'tuning'] });
      void queryClient.invalidateQueries({ queryKey: ['expert', 'activity'] });
      void queryClient.invalidateQueries({ queryKey: ['farms'] });
      void queryClient.invalidateQueries({ queryKey: ['zone'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// Hook danh sách phân trang đề xuất hệ số mờ (EXPERT-FR-011)
export function useCoefficientProposals(
  parameters: CoefficientProposalsQueryParams,
  options?: { enabled?: boolean },
) {
  return usePaginatedListQuery<CoefficientProposal>(
    PROPOSALS_QUERY_KEY(parameters),
    () => reviewsApi.listProposals(parameters),
    parameters.page ?? 1,
    parameters.limit ?? 20,
    { enabled: Boolean(parameters.farmId) && (options?.enabled ?? true), staleTime: 30_000 },
  );
}

// Farm Owner gửi đề xuất hệ số mờ cho chuyên gia
export function useSubmitCoefficientProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) => reviewsApi.submitProposal(zoneId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'proposals'] });
    },
  });
}

// Chuyên gia duyệt và áp dụng đề xuất hệ số mờ
export function useApproveCoefficientProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => reviewsApi.approveProposal(proposalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'proposals'] });
      void queryClient.invalidateQueries({ queryKey: ['expert', 'tuning'] });
      void queryClient.invalidateQueries({ queryKey: ['expert', 'activity'] });
      void queryClient.invalidateQueries({ queryKey: ['farms'] });
      void queryClient.invalidateQueries({ queryKey: ['zone'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// Chuyên gia từ chối đề xuất hệ số mờ kèm lý do
export function useRejectCoefficientProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, note }: { proposalId: string; note: string }) =>
      reviewsApi.rejectProposal(proposalId, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'proposals'] });
      void queryClient.invalidateQueries({ queryKey: ['expert', 'activity'] });
    },
  });
}

// Áp dụng gợi ý trực tiếp khi Farm chưa có chuyên gia (BR-22)
export function useApplySuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) => reviewsApi.applySuggestion(zoneId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'proposals'] });
      void queryClient.invalidateQueries({ queryKey: ['expert', 'tuning'] });
      void queryClient.invalidateQueries({ queryKey: ['farms'] });
      void queryClient.invalidateQueries({ queryKey: ['zone'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
