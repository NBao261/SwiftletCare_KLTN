import { describe, expect, it } from 'vitest';
import { getDisagreementDirection } from '@/components/features/domain-expert/reports/DisagreementDayCard';
import {
  formatAgreementIndex,
  formatRatePercent,
} from '@/components/features/domain-expert/reports/DisagreementsSection';
import { NO_VALUE } from '@/constants/display';
import { disagreementsApi } from '@/apis/domain-expert/disagreements.api';
import {
  DISAGREEMENTS_QUERY_KEY,
  EVALUATION_QUERY_KEY,
} from '@/hooks/domain-expert/useHealthDisagreements';
import type {
  HealthDisagreementsResponse,
  HealthEvaluationResponse,
} from '@/types/expert/disagreements.types';

describe('G-11 — Expert Health Disagreements & Evaluation Unit Tests (EXPERT-FR-022, ANALYTICS-FR-014, BR-28)', () => {
  describe('EXPERT-FR-022: Phân tích chiều lệch và vai trò người chấm thực địa', () => {
    it('getDisagreementDirection xác định đúng chiều lệch STRICTER và LENIENT', () => {
      expect(getDisagreementDirection('WATCH', 'GOOD')).toBe('STRICTER');
      expect(getDisagreementDirection('ACTION', 'GOOD')).toBe('STRICTER');
      expect(getDisagreementDirection('ACTION', 'WATCH')).toBe('STRICTER');

      expect(getDisagreementDirection('GOOD', 'WATCH')).toBe('LENIENT');
      expect(getDisagreementDirection('GOOD', 'ACTION')).toBe('LENIENT');
      expect(getDisagreementDirection('WATCH', 'ACTION')).toBe('LENIENT');
    });
  });

  describe('ANALYTICS-FR-014: Định dạng chỉ số Độ đồng thuận & Tỷ lệ báo động giả', () => {
    it('formatRatePercent chuyển tỷ lệ 0..1 sang phần trăm 1 chữ số thập phân', () => {
      expect(formatRatePercent(0.8571)).toBe('85.7%');
      expect(formatRatePercent(0)).toBe('0.0%');
      expect(formatRatePercent(1)).toBe('100.0%');
      expect(formatRatePercent(null)).toBe(NO_VALUE);
      expect(formatRatePercent(undefined)).toBe(NO_VALUE);
    });

    it('formatAgreementIndex định dạng hệ số Kappa / AC1 với 2 chữ số thập phân', () => {
      expect(formatAgreementIndex(0.742)).toBe('0.74');
      expect(formatAgreementIndex(0)).toBe('0.00');
      expect(formatAgreementIndex(null)).toBe(NO_VALUE);
      expect(formatAgreementIndex(undefined)).toBe(NO_VALUE);
    });
  });

  describe('API & Query Key Contract (GET /health-reports/disagreements & GET /health-reports/evaluation)', () => {
    it('DISAGREEMENTS_QUERY_KEY và EVALUATION_QUERY_KEY sinh khóa cache nhất quán', () => {
      expect(
        DISAGREEMENTS_QUERY_KEY({
          farmId: 'farm-01',
          from: '2026-11-01',
          to: '2026-11-10',
        }),
      ).toEqual([
        'expert',
        'health-disagreements',
        'farm-01',
        '',
        '2026-11-01',
        '2026-11-10',
      ]);

      expect(
        EVALUATION_QUERY_KEY({
          farmId: 'farm-01',
          from: '2026-11-01',
          to: '2026-11-10',
          role: 'FARM_OWNER',
        }),
      ).toEqual([
        'expert',
        'health-evaluation',
        'farm-01',
        '',
        '2026-11-01',
        '2026-11-10',
        'FARM_OWNER',
      ]);
    });

    it('disagreementsApi export đầy đủ cả listDisagreements và getEvaluation', () => {
      expect(typeof disagreementsApi.listDisagreements).toBe('function');
      expect(typeof disagreementsApi.getEvaluation).toBe('function');
    });

    it('Cấu trúc HealthDisagreementsResponse và HealthEvaluationResponse khớp schema backend', () => {
      const disagreementsSample: HealthDisagreementsResponse = {
        from: '2026-11-01',
        to: '2026-11-10',
        houses: [
          {
            house_id: 'house-1',
            house_name: 'Nhà Yến A',
            health_levels: {
              in_range_slight_pct: 80,
              in_range_clear_pct: 60,
              air_slight_h: 2,
              air_clear_h: 6,
              noise_slight: 2,
              noise_clear: 5,
            },
          },
        ],
        days: [
          {
            day_id: 'day-1',
            house_id: 'house-1',
            house_name: 'Nhà Yến A',
            date: '2026-11-09',
            current_status: 'WATCH',
            current_reasons: [
              {
                code: 'NOISE_EPISODES',
                source: 'noise',
                level: 'SLIGHT',
                values: { episodes: 2 },
              },
            ],
            indicators: {
              environment: { value: 92.5, level: 'NORMAL' },
              air: { value: 0.5, level: 'NORMAL' },
              flock: { value: 3.2, level: 'NORMAL' },
              noise: { value: 2, level: 'SLIGHT' },
            },
            disagreements: [
              {
                assessor: { full_name: 'Trần Văn Chủ', role: 'FARM_OWNER' },
                rating: 'GOOD',
                snapshot_status: 'WATCH',
                snapshot_reasons: [
                  {
                    code: 'NOISE_EPISODES',
                    source: 'noise',
                    level: 'SLIGHT',
                    values: { episodes: 2 },
                  },
                ],
                snapshot_levels: {
                  environment: 'NORMAL',
                  air: 'NORMAL',
                  flock: 'NORMAL',
                  noise: 'SLIGHT',
                },
                note: 'Đàn chim yên tĩnh, tiếng ồn do xe chạy ngoài đường',
                at: '2026-11-10T01:30:00.000Z',
              },
            ],
          },
        ],
      };

      const evaluationSample: HealthEvaluationResponse = {
        from: '2026-11-01',
        to: '2026-11-10',
        role: null,
        rated_count: 10,
        insufficient_data_count: 1,
        agreement: { value: 0.8, ci_low: 0.49, ci_high: 0.94 },
        weighted_kappa: 0.72,
        gwet_ac1: 0.76,
        confusion_matrix: {
          labels: ['GOOD', 'WATCH', 'ACTION'],
          rows: 'system',
          columns: 'rater',
          counts: [
            [6, 1, 0],
            [1, 1, 0],
            [0, 0, 1],
          ],
        },
        false_alarm_rate: {
          combined: 0.14,
          environment: 0,
          air: 0,
          flock: 0,
          noise: 0.14,
        },
        ratings: [],
      };

      expect(disagreementsSample.days).toHaveLength(1);
      expect(disagreementsSample.days[0].disagreements[0].snapshot_levels.noise).toBe('SLIGHT');
      expect(evaluationSample.agreement?.value).toBe(0.8);
      expect(evaluationSample.false_alarm_rate.noise).toBe(0.14);
    });
  });
});
