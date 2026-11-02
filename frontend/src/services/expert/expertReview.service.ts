// Tái xuất reviewsApi từ apis/domain-expert/reviews.api theo chuẩn FE_Design §12.2
import { reviewsApi } from '@/apis/domain-expert/reviews.api';

export const expertReviewService = {
  getReviews: (parameters: Parameters<typeof reviewsApi.listReviews>[0]) =>
    reviewsApi.listReviews(parameters).then(response => response.data),

  acceptReview: (reviewId: string) =>
    reviewsApi.acceptReview(reviewId).then(response => response.data),

  revertReview: (reviewId: string) =>
    reviewsApi.revertReview(reviewId).then(response => response.data),

  getProposals: (parameters: Parameters<typeof reviewsApi.listProposals>[0]) =>
    reviewsApi.listProposals(parameters).then(response => response.data),

  submitProposal: (zoneId: string) =>
    reviewsApi.submitProposal(zoneId).then(response => response.data),

  approveProposal: (proposalId: string) =>
    reviewsApi.approveProposal(proposalId).then(response => response.data),

  rejectProposal: (proposalId: string, note: string) =>
    reviewsApi.rejectProposal(proposalId, note).then(response => response.data),

  applySuggestion: (zoneId: string) =>
    reviewsApi.applySuggestion(zoneId).then(response => response.data),
};
