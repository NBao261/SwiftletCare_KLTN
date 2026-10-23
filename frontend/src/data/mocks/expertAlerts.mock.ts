/**
 * Mock Fallback — Màn hình 02A_Expert_Alerts_v3 & 02B_Expert_Verdict_Drawer_v3
 * EXPERT-FR-003 | SRS v2.1.4
 */
import type { ExpertVerdictStats, InferredAlertItem } from '@/types/expert.types'

export const MOCK_EXPERT_VERDICT_STATS: ExpertVerdictStats[] = [
  { type: 'NOISE_ANOMALY', confirmed: 8, rejected: 1, pending: 2, confirmedPct: 89 },
  { type: 'PUMP_DRY', confirmed: 5, rejected: 0, pending: 1, confirmedPct: 100 },
  { type: 'SENSOR_ANOMALY', confirmed: 3, rejected: 1, pending: 0, confirmedPct: 75 },
  { type: 'LOW_RETURN_RATE', confirmed: 2, rejected: 1, pending: 0, confirmedPct: 67 },
]

export const MOCK_INFERRED_ALERTS: InferredAlertItem[] = [
  {
    _id: 'alert_inf_001',
    farm_id: 'farm_demo_01',
    zone_id: 'zone_demo_01',
    node_id: 'node_001',
    type: 'NOISE_ANOMALY',
    severity: 'MEDIUM',
    status: 'ACTIVE',
    title: 'Phát hiện tiếng ồn lạ trong nhà yến',
    message: 'Âm thanh 78 dB vượt ngưỡng biên độ 15 dB so với nền trong 12 giây liên tiếp.',
    created_at: new Date(Date.now() - 35 * 60_000).toISOString(),
    last_seen_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    occurrence_count: 3,
    metadata: { sound_db: 78, noise_margin: 15, duration_sec: 12 },
  },
  {
    _id: 'alert_inf_002',
    farm_id: 'farm_demo_01',
    zone_id: 'zone_demo_01',
    node_id: 'node_001',
    type: 'SENSOR_ANOMALY',
    severity: 'MEDIUM',
    status: 'ACTIVE',
    title: 'Cảm biến bất thường (Độ ẩm lệch +6,5% giữa 2 thiết bị)',
    message: 'Chênh lệch độ ẩm giữa node_001 và node_002 vượt ngưỡng 5%RH trong 45 phút.',
    created_at: new Date(Date.now() - 85 * 60_000).toISOString(),
    last_seen_at: new Date(Date.now() - 25 * 60_000).toISOString(),
    occurrence_count: 2,
    metadata: { diff_pct: 6.5, duration_min: 45 },
  },
  {
    _id: 'alert_inf_003',
    farm_id: 'farm_demo_01',
    zone_id: 'zone_demo_01',
    node_id: 'node_001',
    type: 'NOISE_ANOMALY',
    severity: 'MEDIUM',
    status: 'ACTIVE',
    title: 'Tiếng động lạ ban đêm khu vực lối vào',
    message: 'Ghi nhận tiếng ồn 72 dB lúc 01:25. Cần kiểm chứng có sinh vật gây hại.',
    created_at: new Date(Date.now() - 180 * 60_000).toISOString(),
    occurrence_count: 1,
    metadata: { sound_db: 72, noise_margin: 15 },
  },
  {
    _id: 'alert_inf_004',
    farm_id: 'farm_demo_01',
    zone_id: 'zone_demo_01',
    node_id: 'node_001',
    type: 'LOW_RETURN_RATE',
    severity: 'LOW',
    status: 'ACKNOWLEDGED',
    title: 'Tỷ lệ chim về tổ giảm 24% so với trung bình tuần',
    message: 'Tỷ lệ chim về đạt 64.2% so với đường cơ sở 7 ngày 88.2%.',
    created_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
    occurrence_count: 1,
    metadata: { return_rate: 64.2, baseline_rate: 88.2, drop_pct: 24.0 },
    expert_verdict: {
      result: 'CONFIRMED',
      note: 'Thời tiết mưa bão ngoài trời làm chim về muộn.',
      by: { _id: 'user_exp_01', full_name: 'Chuyên gia Hoàng Nam' },
      at: new Date(Date.now() - 20 * 3600_000).toISOString(),
    },
  },
]
