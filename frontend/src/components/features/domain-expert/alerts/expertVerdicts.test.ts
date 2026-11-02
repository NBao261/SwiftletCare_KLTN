import { describe, expect, it } from 'vitest'
import type { InferredAlertItem, AlertEvidence, ExpertActivityEntry } from '@/types/expert.types'

describe('G-03 — Vòng chuyên gia & Thẩm định cảnh báo (EXPERT-FR-003, ALERT-FR-014, EXPERT-FR-009, BR-22)', () => {
  it('cảnh báo DISMISSED lưu trữ previous_status và thông tin người bác bỏ', () => {
    const alert: InferredAlertItem = {
      _id: 'alt-1',
      farm_id: 'farm-1',
      zone_id: 'zone-1',
      type: 'NOISE_ANOMALY',
      severity: 'HIGH',
      status: 'DISMISSED',
      previous_status: 'ACTIVE',
      title: 'Tiếng ồn bất thường',
      message: 'Âm thanh vượt ngưỡng 85 dB',
      created_at: '2026-11-01T10:00:00Z',
      expert_verdict: {
        result: 'REJECTED',
        note: 'Nhiễu do công trình lân cận, không phải âm thanh chim hoảng loạn',
        by: { _id: 'exp-1', full_name: 'Nguyễn Văn Chuyên Gia' },
        role: 'DOMAIN_EXPERT',
        at: '2026-11-01T10:15:00Z',
      },
    }

    expect(alert.status).toBe('DISMISSED')
    expect(alert.previous_status).toBe('ACTIVE')
    expect(alert.expert_verdict?.result).toBe('REJECTED')
    expect(alert.expert_verdict?.note).toBe('Nhiễu do công trình lân cận, không phải âm thanh chim hoảng loạn')
    expect(typeof alert.expert_verdict?.by).toBe('object')
    if (typeof alert.expert_verdict?.by === 'object') {
      expect(alert.expert_verdict.by.full_name).toBe('Nguyễn Văn Chuyên Gia')
    }
  })

  it('hỗ trợ Farm Owner đưa ra kết luận thay thế khi farm chưa có chuyên gia (BR-22)', () => {
    const alert: InferredAlertItem = {
      _id: 'alt-2',
      farm_id: 'farm-1',
      zone_id: 'zone-1',
      type: 'SENSOR_ANOMALY',
      severity: 'MEDIUM',
      status: 'DISMISSED',
      previous_status: 'ACKNOWLEDGED',
      title: 'Cảm biến độ ẩm lệch',
      message: 'Độ ẩm lệch 12% so với trung bình',
      created_at: '2026-11-01T11:00:00Z',
      expert_verdict: {
        result: 'REJECTED',
        note: 'Đã kiểm tra đầu dò độ ẩm tại chỗ, đang lau chùi bụi bẩn',
        by: { _id: 'owner-1', full_name: 'Trần Văn Chủ Nhà' },
        role: 'FARM_OWNER',
        at: '2026-11-01T11:10:00Z',
      },
    }

    expect(alert.expert_verdict?.role).toBe('FARM_OWNER')
    expect(alert.previous_status).toBe('ACKNOWLEDGED')
  })

  it('ALERT-FR-014: gói bằng chứng thể hiện trạng thái missing thay vì số 0', () => {
    const evidence: AlertEvidence = {
      alert_id: 'alt-1',
      type: 'NOISE_ANOMALY',
      window: { from: '2026-11-01T09:30:00Z', to: '2026-11-01T10:30:00Z' },
      telemetry: { status: 'missing', samples: [] },
      bird_counts: { status: 'ok', buckets: [{ bucket_start: '2026-11-01T09:35:00Z', entry_count: 5, exit_count: 2 }] },
      zones_in_range: null,
      noise_alerts: null,
      device_alerts: [],
      earlier_verdicts: [],
    }

    expect(evidence.telemetry?.status).toBe('missing')
    expect(evidence.telemetry?.samples).toHaveLength(0)
    expect(evidence.bird_counts?.status).toBe('ok')
    expect(evidence.bird_counts?.buckets).toHaveLength(1)
  })

  it('EXPERT-FR-003: danh sách kết luận tiền lệ earlier_verdicts giới hạn tối đa 10 mục', () => {
    const verdicts: InferredAlertItem[] = Array.from({ length: 15 }, (_, i) => ({
      _id: `earlier-${i}`,
      farm_id: 'farm-1',
      zone_id: 'zone-1',
      type: 'NOISE_ANOMALY',
      severity: 'HIGH',
      status: 'DISMISSED',
      title: `Cảnh báo ${i}`,
      message: `Message ${i}`,
      created_at: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
      expert_verdict: {
        result: i % 2 === 0 ? 'CONFIRMED' : 'REJECTED',
        note: `Note ${i}`,
        by: { _id: 'exp-1', full_name: 'Nguyễn Văn Chuyên Gia' },
        role: 'DOMAIN_EXPERT',
        at: `2026-10-${String(i + 1).padStart(2, '0')}T11:00:00Z`,
      },
    }))

    const evidence: AlertEvidence = {
      alert_id: 'alt-current',
      type: 'NOISE_ANOMALY',
      window: { from: '2026-11-01T09:30:00Z', to: '2026-11-01T10:30:00Z' },
      device_alerts: [],
      earlier_verdicts: verdicts.slice(0, 10),
    }

    expect(evidence.earlier_verdicts).toHaveLength(10)
    expect(evidence.earlier_verdicts[0]._id).toBe('earlier-0')
  })

  it('EXPERT-FR-009: nhật ký hoạt động lưu trữ hành động của Domain Expert và Farm Owner', () => {
    const expertEntry: ExpertActivityEntry = {
      _id: 'act-1',
      action: 'ALERT_VERDICT_SET',
      actor: { _id: 'exp-1', full_name: 'Nguyễn Văn Chuyên Gia' },
      actor_role: 'DOMAIN_EXPERT',
      target_type: 'Alert',
      target_id: 'alt-1',
      zone_id: 'zone-1',
      metadata: { result: 'CONFIRMED', type: 'NOISE_ANOMALY' },
      created_at: '2026-11-01T10:15:00Z',
    }

    const ownerEntry: ExpertActivityEntry = {
      _id: 'act-2',
      action: 'DETECTION_TUNING_UPDATED',
      actor: { _id: 'owner-1', full_name: 'Trần Văn Chủ Nhà' },
      actor_role: 'FARM_OWNER',
      target_type: 'Zone',
      target_id: 'zone-1',
      zone_id: 'zone-1',
      metadata: { before: { delta_temp: 5 }, after: { delta_temp: 6 } },
      created_at: '2026-11-01T11:20:00Z',
    }

    expect(expertEntry.actor_role).toBe('DOMAIN_EXPERT')
    expect(ownerEntry.actor_role).toBe('FARM_OWNER')
    expect(ownerEntry.action).toBe('DETECTION_TUNING_UPDATED')
  })
})
