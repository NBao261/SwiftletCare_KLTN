import { describe, expect, it } from 'vitest';
import type {
  ParameterReview,
  CoefficientProposal,
  ParameterReviewStatus,
  CoefficientProposalStatus,
} from '@/types/expert/reviews.types';

describe('G-04 — Frontend Reviews & Proposals Unit Tests (EXPERT-FR-010, EXPERT-FR-011)', () => {
  describe('EXPERT-FR-010: Mục duyệt thay đổi tham số của Farm Owner', () => {
    it('Phát hiện chính xác các trường thay đổi giữa old_values và new_values', () => {
      const review: ParameterReview = {
        _id: 'rev-1',
        zone_id: 'zone-101',
        farm_id: 'farm-1',
        group: 'thresholds',
        old_values: {
          temp_min: 26,
          temp_max: 31,
          humidity_min: 75,
          humidity_max: 90,
        },
        new_values: {
          temp_min: 26,
          temp_max: 32, // Đã đổi 31 -> 32
          humidity_min: 70, // Đã đổi 75 -> 70
          humidity_max: 90,
        },
        status: 'PENDING_REVIEW',
        changed_by: { _id: 'user-fo-1', full_name: 'Chủ nhà yến 1' },
        created_at: '2026-11-02T10:00:00Z',
        updated_at: '2026-11-02T10:00:00Z',
      };

      const changedKeys = Object.keys(review.new_values).filter(
        (key) => JSON.stringify(review.old_values[key]) !== JSON.stringify(review.new_values[key])
      );

      expect(changedKeys).toEqual(['temp_max', 'humidity_min']);
      expect(changedKeys).not.toContain('temp_min');
      expect(changedKeys).not.toContain('humidity_max');
    });

    it('Xác định đúng trạng thái duyệt tham số: PENDING_REVIEW, ACCEPTED, REVERTED', () => {
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
    });
  });

  describe('EXPERT-FR-011: Đề xuất hệ số mờ và thẩm định lý do từ chối', () => {
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

    it('Quy tắc từ chối đề xuất: lý do bắt buộc không rỗng và không vượt quá 1000 ký tự', () => {
      const validateRejectNote = (note: string): { isValid: boolean; error?: string } => {
        const trimmed = note.trim();
        if (!trimmed) {
          return { isValid: false, error: 'Bắt buộc phải ghi rõ lý do chuyên môn khi từ chối đề xuất.' };
        }
        if (trimmed.length > 1000) {
          return { isValid: false, error: 'Lý do không được vượt quá 1000 ký tự.' };
        }
        return { isValid: true };
      };

      // Chuỗi rỗng -> không hợp lệ
      expect(validateRejectNote('').isValid).toBe(false);
      expect(validateRejectNote('   ').isValid).toBe(false);

      // Chuỗi hợp lệ
      const validNote = 'Biên độ ẩm 3.0 quá rộng trong mùa khô, dễ dẫn đến dao động lớn.';
      expect(validateRejectNote(validNote).isValid).toBe(true);

      // Chuỗi > 1000 ký tự -> không hợp lệ
      const tooLongNote = 'A'.repeat(1001);
      expect(validateRejectNote(tooLongNote).isValid).toBe(false);
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
});
