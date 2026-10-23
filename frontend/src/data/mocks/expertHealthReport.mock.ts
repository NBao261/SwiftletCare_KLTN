/**
 * Mock Fallback — Màn hình 05_Health_Reports_v3
 * EXPERT-FR-005/006/007 | SRS v2.1.4
 */
import type { ZoneHealthReportItem } from '@/types/expert.types'

const nowMs = Date.now()
const DAY_MS = 86400_000

export const MOCK_HEALTH_REPORTS: ZoneHealthReportItem[] = [
  {
    _id: 'report_w42',
    farm_id: 'farm_demo_01',
    zone_id: 'zone_demo_01',
    period_start: new Date(nowMs - 7 * DAY_MS).toISOString(),
    period_end: new Date(nowMs).toISOString(),
    generated_at: new Date(nowMs).toISOString(),
    metrics: {
      sample_count: 2016,
      temp_in_range_pct: 94.8,
      humidity_in_range_pct: 91.2,
      auto_mode_pct: 100.0,
      misting_switches: 0,
      ventilation_switches: 0,
      alerts_by_type: {},
      avg_return_rate: 96.4,
      nh3_avg: 0.008,
      nh3_max: 0.014,
      co2_avg: 610,
      co2_max: 980,
    },
    // Chờ kết luận của chuyên gia
  },
  {
    _id: 'report_w41',
    farm_id: 'farm_demo_01',
    zone_id: 'zone_demo_01',
    period_start: new Date(nowMs - 14 * DAY_MS).toISOString(),
    period_end: new Date(nowMs - 7 * DAY_MS).toISOString(),
    generated_at: new Date(nowMs - 7 * DAY_MS).toISOString(),
    metrics: {
      sample_count: 2016,
      temp_in_range_pct: 93.2,
      humidity_in_range_pct: 88.5,
      auto_mode_pct: 97.4,
      misting_switches: 412,
      ventilation_switches: 185,
      alerts_by_type: { NOISE_ANOMALY: 1 },
      avg_return_rate: 95.8,
      nh3_avg: 0.010,
      nh3_max: 0.018,
      co2_avg: 620,
      co2_max: 990,
    },
    expert_conclusion: {
      text: 'Nhiệt ẩm ổn định cao trong tuần. Không phát sinh rủi ro thiết bị. Tỷ lệ chim quay về đạt 95.8%.',
      by: { _id: 'user_exp_01', full_name: 'Demo Domain Expert' },
      at: new Date(nowMs - 7 * DAY_MS + 4 * 3600_000).toISOString(),
    },
  },
  {
    _id: 'report_w40',
    farm_id: 'farm_demo_01',
    zone_id: 'zone_demo_01',
    period_start: new Date(nowMs - 21 * DAY_MS).toISOString(),
    period_end: new Date(nowMs - 14 * DAY_MS).toISOString(),
    generated_at: new Date(nowMs - 14 * DAY_MS).toISOString(),
    metrics: {
      sample_count: 2016,
      temp_in_range_pct: 91.5,
      humidity_in_range_pct: 86.0,
      auto_mode_pct: 95.0,
      misting_switches: 460,
      ventilation_switches: 210,
      alerts_by_type: { PUMP_DRY: 1 },
      avg_return_rate: 94.9,
      nh3_avg: 0.012,
      nh3_max: 0.020,
      co2_avg: 630,
      co2_max: 1010,
    },
    expert_conclusion: {
      text: 'Khuyến nghị vệ sinh béc phun định kỳ để duy trì độ phủ sương đồng đều khắp phòng làm tổ.',
      by: { _id: 'user_exp_01', full_name: 'Demo Domain Expert' },
      at: new Date(nowMs - 14 * DAY_MS + 3 * 3600_000).toISOString(),
    },
  },
  {
    _id: 'report_w39',
    farm_id: 'farm_demo_01',
    zone_id: 'zone_demo_01',
    period_start: new Date(nowMs - 28 * DAY_MS).toISOString(),
    period_end: new Date(nowMs - 21 * DAY_MS).toISOString(),
    generated_at: new Date(nowMs - 21 * DAY_MS).toISOString(),
    metrics: {
      sample_count: 2016,
      temp_in_range_pct: 90.8,
      humidity_in_range_pct: 85.2,
      auto_mode_pct: 93.6,
      misting_switches: 490,
      ventilation_switches: 230,
      alerts_by_type: { THRESHOLD_BREACH: 2 },
      avg_return_rate: 94.2,
      nh3_avg: 0.015,
      nh3_max: 0.022,
      co2_avg: 640,
      co2_max: 1020,
    },
    expert_conclusion: {
      text: 'Ghi nhận thời tiết giao mùa làm độ ẩm giảm nhẹ đầu tuần. Bộ điều khiển mờ đã bù ẩm kịp thời.',
      by: { _id: 'user_exp_01', full_name: 'Demo Domain Expert' },
      at: new Date(nowMs - 21 * DAY_MS + 5 * 3600_000).toISOString(),
    },
  },
]
