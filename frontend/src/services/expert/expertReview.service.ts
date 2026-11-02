/**
 * expertReview.service.ts — API calls cho mục duyệt tham số và đề xuất hệ số mờ (G-04)
 * SRS: EXPERT-FR-010, EXPERT-FR-011; Report 3 §6.10, §6.11
 */

import api from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  ParameterReview,
  CoefficientProposal,
  ParameterReviewsQueryParams,
  CoefficientProposalsQueryParams,
} from '@/types/expert/reviews.types';

export const expertReviewService = {
  // ── 1. Mục duyệt thay đổi tham số của Farm Owner (EXPERT-FR-010) ───────────
  getReviews: async (params: ParameterReviewsQueryParams) => {
    const res = await api.get<ApiResponse<ParameterReview[]>>('/expert-activity/reviews', { params });
    return res.data;
  },

  acceptReview: async (reviewId: string) => {
    const res = await api.put<ApiResponse<ParameterReview>>(`/expert-activity/reviews/${reviewId}/accept`);
    return res.data;
  },

  revertReview: async (reviewId: string) => {
    const res = await api.put<ApiResponse<ParameterReview>>(`/expert-activity/reviews/${reviewId}/revert`);
    return res.data;
  },

  // ── 2. Đề xuất hệ số điều khiển mờ (EXPERT-FR-011) ──────────────────────────
  getProposals: async (params: CoefficientProposalsQueryParams) => {
    const res = await api.get<ApiResponse<CoefficientProposal[]>>('/expert-activity/proposals', { params });
    return res.data;
  },

  submitProposal: async (zoneId: string) => {
    const res = await api.post<ApiResponse<CoefficientProposal>>('/expert-activity/proposals', { zoneId });
    return res.data;
  },

  approveProposal: async (proposalId: string) => {
    const res = await api.put<ApiResponse<CoefficientProposal>>(`/expert-activity/proposals/${proposalId}/approve`);
    return res.data;
  },

  rejectProposal: async (proposalId: string, note: string) => {
    const res = await api.put<ApiResponse<CoefficientProposal>>(`/expert-activity/proposals/${proposalId}/reject`, {
      note,
    });
    return res.data;
  },

  // ── 3. Áp dụng gợi ý trực tiếp (Chuyên gia hoặc Farm Owner khi chưa có chuyên gia) ──
  applySuggestion: async (zoneId: string) => {
    const res = await api.post<ApiResponse<unknown>>(`/farms/zones/${zoneId}/fuzzy-tuning/apply-suggestion`);
    return res.data;
  },
};
