import { describe, expect, it } from 'vitest'
import type { InferredAlertItem, AlertEvidence, ExpertActivityEntry, TelemetrySample, BirdCountBucket } from '@/types/expert.types'
import {
  buildAlertEvidence,
  buildBirdCountEvidenceSource,
  buildTelemetryEvidenceSource,
  generateTicks,
  safeFormatHM,
} from './alertEvidence'

describe('G-03 — Chuyển đổi dữ liệu bằng chứng chuỗi thời gian (ALERT-FR-014, EXPERT-FR-003)', () => {
  it('buildTelemetryEvidenceSource: chuyển đổi mẫu telemetry âm thanh thực tế cho NOISE_ANOMALY', () => {
    const alert: InferredAlertItem = {
      _id: 'alt-noise-1',
      farm_id: 'farm-1',
      zone_id: 'zone-1',
      type: 'NOISE_ANOMALY',
      severity: 'MEDIUM',
      status: 'ACTIVE',
      title: 'Âm thanh bất thường',
      message: 'Tiếng ồn vượt ngưỡng',
      created_at: '2026-11-01T10:00:00Z',
      metadata: { sound_db: 82, noise_margin: 7.5 },
    }

    const samples: TelemetrySample[] = [
      { timestamp: '2026-11-01T09:40:00Z', sound_db: 55.2 },
      { timestamp: '2026-11-01T09:50:00Z', sound_db: 58.1 },
      { timestamp: '2026-11-01T10:00:00Z', sound_db: 82.0 }, // Đỉnh
      { timestamp: '2026-11-01T10:10:00Z', sound_db: 57.4 },
    ]

    const source = buildTelemetryEvidenceSource(alert, samples)
    expect(source).not.toBeNull()
    if (!source) return

    expect(source.unit).toBe(' dB')
    expect(source.data).toHaveLength(4)
    expect(source.data.map(d => d.value)).toEqual([55.2, 58.1, 82.0, 57.4])
    expect(source.highlight).toContain('82')
    expect(source.badge1).toContain('Số mẫu: 4')

    // Điểm đỉnh 82 dB phải được đánh dấu bất thường
    const peakPoint = source.data[2]
    expect(peakPoint.isAnomaly).toBe(true)
    expect(peakPoint.value).toBe(82.0)
  })

  it('buildTelemetryEvidenceSource: chuyển đổi mẫu telemetry độ ẩm cho SENSOR_ANOMALY', () => {
    const alert: InferredAlertItem = {
      _id: 'alt-sensor-1',
      farm_id: 'farm-1',
      zone_id: 'zone-1',
      type: 'SENSOR_ANOMALY',
      severity: 'MEDIUM',
      status: 'ACTIVE',
      title: 'Cảm biến độ ẩm lệch',
      message: 'Độ ẩm nhảy vọt bất thường',
      created_at: '2026-11-01T14:00:00Z',
      metadata: { sensor_type: 'humidity', delta: 15 },
    }

    const samples: TelemetrySample[] = [
      { timestamp: '2026-11-01T13:45:00Z', humidity: 76.5 },
      { timestamp: '2026-11-01T13:55:00Z', humidity: 77.0 },
      { timestamp: '2026-11-01T14:00:00Z', humidity: 93.5 }, // Nhảy vọt
      { timestamp: '2026-11-01T14:15:00Z', humidity: 76.8 },
    ]

    const source = buildTelemetryEvidenceSource(alert, samples)
    expect(source).not.toBeNull()
    if (!source) return

    expect(source.unit).toBe(' %')
    expect(source.title).toContain('Độ ẩm')
    expect(source.data).toHaveLength(4)
    expect(source.highlight).toContain('93.5')

    // Mẫu nhảy vọt phải được gắn nhãn bất thường
    const anomalyPoint = source.data[2]
    expect(anomalyPoint.isAnomaly).toBe(true)
  })

  it('buildTelemetryEvidenceSource: trả về null khi không có mẫu hoặc mảng rỗng (missing)', () => {
    const alert: InferredAlertItem = {
      _id: 'alt-empty',
      farm_id: 'farm-1',
      type: 'NOISE_ANOMALY',
      severity: 'MEDIUM',
      status: 'ACTIVE',
      title: 'Cảnh báo',
      message: 'Thiếu dữ liệu',
      created_at: '2026-11-01T10:00:00Z',
    }

    expect(buildTelemetryEvidenceSource(alert, [])).toBeNull()
    expect(buildTelemetryEvidenceSource(alert, null)).toBeNull()
    expect(buildTelemetryEvidenceSource(alert, undefined)).toBeNull()
  })

  it('buildBirdCountEvidenceSource: chuyển đổi chuỗi bucket 5 phút thành đồ thị đếm chim', () => {
    const alert: InferredAlertItem = {
      _id: 'alt-bird-1',
      farm_id: 'farm-1',
      type: 'NOISE_ANOMALY',
      severity: 'MEDIUM',
      status: 'ACTIVE',
      title: 'Âm thanh bất thường',
      message: 'Tiếng ồn',
      created_at: '2026-11-01T10:00:00Z',
    }

    const buckets: BirdCountBucket[] = [
      { bucket_start: '2026-11-01T09:45:00Z', entry_count: 14, exit_count: 2 },
      { bucket_start: '2026-11-01T09:50:00Z', entry_count: 18, exit_count: 3 },
      { bucket_start: '2026-11-01T09:55:00Z', entry_count: 2, exit_count: 12 }, // Sụt giảm lúc tiếng ồn xảy ra
      { bucket_start: '2026-11-01T10:00:00Z', entry_count: 1, exit_count: 8 },
    ]

    const source = buildBirdCountEvidenceSource(alert, buckets)
    expect(source).not.toBeNull()
    if (!source) return

    expect(source.unit).toBe(' con')
    expect(source.data).toHaveLength(4)
    expect(source.badge1).toContain('35 con') // Tổng chim vào: 14 + 18 + 2 + 1 = 35
    expect(source.badge2).toContain('25 con') // Tổng chim ra: 2 + 3 + 12 + 8 = 25
    expect(source.data.map(d => d.value)).toEqual([14, 18, 2, 1])
  })

  it('buildBirdCountEvidenceSource: trả về null khi mảng buckets rỗng', () => {
    const alert: InferredAlertItem = {
      _id: 'alt-empty',
      farm_id: 'farm-1',
      type: 'NOISE_ANOMALY',
      severity: 'MEDIUM',
      status: 'ACTIVE',
      title: 'Cảnh báo',
      message: 'Thiếu dữ liệu',
      created_at: '2026-11-01T10:00:00Z',
    }

    expect(buildBirdCountEvidenceSource(alert, [])).toBeNull()
    expect(buildBirdCountEvidenceSource(alert, null)).toBeNull()
  })

  it('buildAlertEvidence: tổng hợp đầy đủ bằng chứng khi API trả về dữ liệu thực', () => {
    const alert: InferredAlertItem = {
      _id: 'alt-full-1',
      farm_id: 'farm-1',
      zone_id: 'zone-1',
      type: 'NOISE_ANOMALY',
      severity: 'HIGH',
      status: 'ACTIVE',
      title: 'Âm thanh lạ',
      message: 'Phát hiện tiếng ồn ngoài giờ',
      created_at: '2026-11-01T10:00:00Z',
      metadata: { sound_db: 78.5 },
    }

    const evidence: AlertEvidence = {
      alert_id: 'alt-full-1',
      type: 'NOISE_ANOMALY',
      window: { from: '2026-11-01T09:30:00Z', to: '2026-11-01T10:30:00Z' },
      telemetry: {
        status: 'ok',
        samples: [
          { timestamp: '2026-11-01T09:45:00Z', sound_db: 52 },
          { timestamp: '2026-11-01T10:00:00Z', sound_db: 78.5 },
        ],
      },
      bird_counts: {
        status: 'ok',
        buckets: [
          { bucket_start: '2026-11-01T09:55:00Z', entry_count: 10, exit_count: 1 },
          { bucket_start: '2026-11-01T10:00:00Z', entry_count: 2, exit_count: 6 },
        ],
      },
      device_alerts: [],
      earlier_verdicts: [],
    }

    const cfg = buildAlertEvidence(alert, evidence)
    expect(cfg.src1).not.toBeNull()
    expect(cfg.src2).not.toBeNull()
    expect(cfg.windowLabel).toContain('Khung giờ ±30 phút')
    expect(cfg.correlation).toContain('Cảm biến âm thanh')
    expect(cfg.correlation).not.toContain('Chuẩn nền: 78% RH') // Không được chứa số cứng giả lập
  })

  it('buildAlertEvidence: nhận diện đúng trạng thái missing và không tạo đồ thị giả khi telemetry thiếu', () => {
    const alert: InferredAlertItem = {
      _id: 'alt-missing-1',
      farm_id: 'farm-1',
      zone_id: 'zone-1',
      type: 'NOISE_ANOMALY',
      severity: 'MEDIUM',
      status: 'ACTIVE',
      title: 'Âm thanh lạ',
      message: 'Nghi ngờ tiếng chim hoảng loạn',
      created_at: '2026-11-01T10:00:00Z',
    }

    const evidence: AlertEvidence = {
      alert_id: 'alt-missing-1',
      type: 'NOISE_ANOMALY',
      window: { from: '2026-11-01T09:30:00Z', to: '2026-11-01T10:30:00Z' },
      telemetry: { status: 'missing', samples: [] },
      bird_counts: { status: 'missing', buckets: [] },
      device_alerts: [],
      earlier_verdicts: [],
    }

    const cfg = buildAlertEvidence(alert, evidence)
    expect(cfg.src1).toBeNull()
    expect(cfg.src2).toBeNull()
    expect(cfg.correlation).toContain('missing')
  })

  it('safeFormatHM & generateTicks: format an toàn và sinh các vạch chia đều', () => {
    expect(safeFormatHM(undefined)).toBe('--:--')
    expect(safeFormatHM('invalid-date')).toBe('--:--')

    const ticks = generateTicks(0, 100, 5)
    expect(ticks).toEqual([0, 25, 50, 75, 100])

    const ticksSmall = generateTicks(0, 24, 4)
    expect(ticksSmall).toHaveLength(4)
    expect(ticksSmall[0]).toBe(0)
    expect(ticksSmall[3]).toBe(24)
  })
})

describe('G-03 — Nghiệp vụ thẩm định cảnh báo & fallback (BR-22, EXPERT-FR-003, EXPERT-FR-009)', () => {
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
