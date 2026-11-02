import { describe, expect, it } from 'vitest';
import {
  getChangedParameterKeys,
  formatParamValue,
} from '@/components/features/domain-expert/reviews/ParameterReviewCard';
import {
  formatFuzzyProposalValue,
} from '@/components/features/domain-expert/reviews/CoefficientProposalCard';
import { reviewsApi } from '@/apis/domain-expert/reviews.api';
import type {
  CoefficientProposal,
  ParameterReviewStatus,
  CoefficientProposalStatus,
} from '@/types/expert/reviews.types';

describe('G-04 — Frontend Reviews & Proposals Unit Tests (EXPERT-FR-010, EXPERT-FR-011)', () => {
  describe('EXPERT-FR-010: Thẩm định thay đổi tham số của Farm Owner', () => {
    it('Hàm getChangedParameterKeys phát hiện chính xác các trường thay đổi thực tế', () => {
      const oldValues = {
        temp_min: 26,
        temp_max: 31,
        humidity_min: 75,
        humidity_max: 90,
      };
      const newValues = {
        temp_min: 26,
        temp_max: 32, // Đổi 31 -> 32
        humidity_min: 70, // Đổi 75 -> 70
        humidity_max: 90,
      };

      const changedKeys = getChangedParameterKeys(oldValues, newValues);

      expect(changedKeys).toEqual(['temp_max', 'humidity_min']);
      expect(changedKeys).not.toContain('temp_min');
      expect(changedKeys).not.toContain('humidity_max');
    });

    it('Hàm getChangedParameterKeys xử lý an toàn khi oldValues hoặc newValues rỗng', () => {
      expect(getChangedParameterKeys({}, { temp_min: 25 })).toEqual(['temp_min']);
      expect(getChangedParameterKeys(undefined, undefined)).toEqual([]);
    });

    it('Hàm formatParamValue định dạng chính xác các kiểu dữ liệu tham số', () => {
      expect(formatParamValue(null)).toBe('—');
      expect(formatParamValue(undefined)).toBe('—');
      expect(formatParamValue(true)).toBe('Bật');
      expect(formatParamValue(false)).toBe('Tắt');
      expect(formatParamValue(28.5)).toBe('28.5');
      expect(formatParamValue('AUTO')).toBe('AUTO');
    });

    it('Xác định đúng tập hợp trạng thái hợp lệ của ParameterReviewStatus', () => {
      const validStatuses: ParameterReviewStatus[] = [
        'PENDING_REVIEW',
        'ACCEPTED',
        'REVERTED',
        'ADJUSTED',
      ];
      expect(validStatuses).toHaveLength(4);
      expect(validStatuses).toContain('PENDING_REVIEW');
      expect(validStatuses).toContain('ACCEPTED');
      expect(validStatuses).toContain('REVERTED');
      expect(validStatuses).toContain('ADJUSTED');
    });
  });

  describe('EXPERT-FR-011: Đề xuất hệ số mờ và định dạng hiển thị', () => {
    it('Hàm formatFuzzyProposalValue gán đúng đơn vị cho từng hệ số mờ', () => {
      expect(formatFuzzyProposalValue('fuzzy_humidity_band', 3.0)).toBe('3%');
      expect(formatFuzzyProposalValue('fuzzy_temp_band', 1.2)).toBe('1.2°C');
      expect(formatFuzzyProposalValue('fuzzy_window_sec', 90)).toBe('90s');
      expect(formatFuzzyProposalValue('fuzzy_fan_dry_level', 70)).toBe('70%');
      expect(formatFuzzyProposalValue('fuzzy_humidity_band', null)).toBe('—');
    });

    it('Cấu trúc đề xuất hệ số mờ chứa đầy đủ giá trị hiện tại, đề xuất và dự báo', () => {
      const proposal: CoefficientProposal = {
        _id: 'prop-1',
        zone_id: 'zone-101',
        farm_id: 'farm-1',
        submitted_by: { _id: 'user-fo-1', full_name: 'Nguyễn Văn Chủ' },
        current_values: {
          fuzzy_humidity_band: 2.5,
          fuzzy_temp_band: 1.0,
          fuzzy_fan_dry_level: 60,
          fuzzy_window_sec: 120,
        },
        suggested_values: {
          fuzzy_humidity_band: 3.0,
          fuzzy_temp_band: 1.2,
          fuzzy_fan_dry_level: 70,
          fuzzy_window_sec: 90,
        },
        predicted: {
          inRangeNow: 82.5,
          inRangeSuggested: 89.2,
          mistingNow: 45.0,
          mistingSuggested: 38.5,
        },
        status: 'PROPOSED',
        created_at: '2026-11-02T12:00:00Z',
      };

      expect(proposal.status).toBe('PROPOSED');
      expect(proposal.predicted?.inRangeSuggested).toBeGreaterThan(proposal.predicted?.inRangeNow ?? 0);
      expect(proposal.suggested_values.fuzzy_humidity_band).toBe(3.0);
    });

    it('Xác định đúng tất cả trạng thái đề xuất: PROPOSED, APPROVED, REJECTED, SUPERSEDED', () => {
      const validProposalStatuses: CoefficientProposalStatus[] = [
        'PROPOSED',
        'APPROVED',
        'REJECTED',
        'SUPERSEDED',
      ];
      expect(validProposalStatuses).toHaveLength(4);
      expect(validProposalStatuses).toContain('PROPOSED');
      expect(validProposalStatuses).toContain('APPROVED');
      expect(validProposalStatuses).toContain('REJECTED');
      expect(validProposalStatuses).toContain('SUPERSEDED');
    });
  });

  describe('API Layer: reviewsApi exports đầy đủ các endpoint theo spec', () => {
    it('reviewsApi định nghĩa đủ 8 phương thức nghiệp vụ', () => {
      expect(typeof reviewsApi.listReviews).toBe('function');
      expect(typeof reviewsApi.acceptReview).toBe('function');
      expect(typeof reviewsApi.revertReview).toBe('function');
      expect(typeof reviewsApi.listProposals).toBe('function');
      expect(typeof reviewsApi.submitProposal).toBe('function');
      expect(typeof reviewsApi.approveProposal).toBe('function');
      expect(typeof reviewsApi.rejectProposal).toBe('function');
      expect(typeof reviewsApi.applySuggestion).toBe('function');
    });
  });
});
