/**
 * useExpertReviews.ts — React Query Hooks cho Mục duyệt tham số và Đề xuất hệ số mờ (G-04)
 * SRS: EXPERT-FR-010, EXPERT-FR-011
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expertReviewService } from '@/services/expert/expertReview.service';
import type {
  ParameterReviewsQueryParams,
  CoefficientProposalsQueryParams,
} from '@/types/expert/reviews.types';

export const REVIEWS_QUERY_KEY = (params: Partial<ParameterReviewsQueryParams>) => [
  'expert',
  'reviews',
  params.farmId,
  params.zoneId,
  params.status,
  params.page,
];

export const PROPOSALS_QUERY_KEY = (params: Partial<CoefficientProposalsQueryParams>) => [
  'expert',
  'proposals',
  params.farmId,
  params.zoneId,
  params.status,
  params.page,
];

// ── 1. Hooks cho Mục duyệt thay đổi tham số (EXPERT-FR-010) ──────────────────
export function useParameterReviews(params: ParameterReviewsQueryParams) {
  return useQuery({
    queryKey: REVIEWS_QUERY_KEY(params),
    queryFn: async () => {
      const res = await expertReviewService.getReviews(params);
      return res;
    },
    enabled: Boolean(params.farmId),
    staleTime: 30_000,
  });
}

export function useAcceptParameterReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => expertReviewService.acceptReview(reviewId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expert', 'reviews'] });
      void qc.invalidateQueries({ queryKey: ['expert', 'activity'] });
    },
  });
}

export function useRevertParameterReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => expertReviewService.revertReview(reviewId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expert', 'reviews'] });
      void qc.invalidateQueries({ queryKey: ['expert', 'tuning'] });
      void qc.invalidateQueries({ queryKey: ['expert', 'activity'] });
      void qc.invalidateQueries({ queryKey: ['farms'] });
    },
  });
}

// ── 2. Hooks cho Đề xuất hệ số mờ (EXPERT-FR-011) ────────────────────────────
export function useCoefficientProposals(params: CoefficientProposalsQueryParams) {
  return useQuery({
    queryKey: PROPOSALS_QUERY_KEY(params),
    queryFn: async () => {
      const res = await expertReviewService.getProposals(params);
      return res;
    },
    enabled: Boolean(params.farmId),
    staleTime: 30_000,
  });
}

export function useSubmitCoefficientProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) => expertReviewService.submitProposal(zoneId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expert', 'proposals'] });
    },
  });
}

export function useApproveCoefficientProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => expertReviewService.approveProposal(proposalId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expert', 'proposals'] });
      void qc.invalidateQueries({ queryKey: ['expert', 'tuning'] });
      void qc.invalidateQueries({ queryKey: ['expert', 'activity'] });
      void qc.invalidateQueries({ queryKey: ['farms'] });
    },
  });
}

export function useRejectCoefficientProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, note }: { proposalId: string; note: string }) =>
      expertReviewService.rejectProposal(proposalId, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expert', 'proposals'] });
      void qc.invalidateQueries({ queryKey: ['expert', 'activity'] });
    },
  });
}

export function useApplySuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) => expertReviewService.applySuggestion(zoneId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expert', 'tuning'] });
      void qc.invalidateQueries({ queryKey: ['farms'] });
    },
  });
}
