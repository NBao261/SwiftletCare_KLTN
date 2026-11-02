import api from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  ParameterReview,
  CoefficientProposal,
  ParameterReviewsQueryParams,
  CoefficientProposalsQueryParams,
} from '@/types/expert/reviews.types';

// API gọi các endpoint duyệt thay đổi tham số và đề xuất hệ số mờ (EXPERT-FR-010, EXPERT-FR-011)
export const reviewsApi = {
  // Danh sách mục duyệt thay đổi tham số (EXPERT-FR-010)
  listReviews: (parameters: ParameterReviewsQueryParams) =>
    api.get<ApiResponse<ParameterReview[]>>('/expert-activity/reviews', { params: parameters }),

  // Chuyên gia chấp thuận thay đổi tham số của Farm Owner (EXPERT-FR-010)
  acceptReview: (reviewId: string) =>
    api.put<ApiResponse<ParameterReview>>(`/expert-activity/reviews/${reviewId}/accept`),

  // Chuyên gia hoàn nguyên tham số về giá trị ban đầu (EXPERT-FR-010)
  revertReview: (reviewId: string) =>
    api.put<ApiResponse<ParameterReview>>(`/expert-activity/reviews/${reviewId}/revert`),

  // Danh sách đề xuất hệ số mờ (EXPERT-FR-011)
  listProposals: (parameters: CoefficientProposalsQueryParams) =>
    api.get<ApiResponse<CoefficientProposal[]>>('/expert-activity/proposals', { params: parameters }),

  // Farm Owner gửi gợi ý hệ số cho Chuyên gia duyệt (EXPERT-FR-011)
  submitProposal: (zoneId: string) =>
    api.post<ApiResponse<CoefficientProposal>>('/expert-activity/proposals', { zoneId }),

  // Chuyên gia duyệt và áp dụng đề xuất hệ số (EXPERT-FR-011)
  approveProposal: (proposalId: string) =>
    api.put<ApiResponse<CoefficientProposal>>(`/expert-activity/proposals/${proposalId}/approve`),

  // Chuyên gia từ chối đề xuất hệ số kèm lý do bắt buộc (EXPERT-FR-011)
  rejectProposal: (proposalId: string, note: string) =>
    api.put<ApiResponse<CoefficientProposal>>(`/expert-activity/proposals/${proposalId}/reject`, { note }),

  // Áp dụng gợi ý trực tiếp khi Farm chưa có chuyên gia (BR-22) hoặc do Chuyên gia trực tiếp thực hiện
  applySuggestion: (zoneId: string) =>
    api.post<ApiResponse<unknown>>(`/farms/zones/${zoneId}/fuzzy-tuning/apply-suggestion`),
};
