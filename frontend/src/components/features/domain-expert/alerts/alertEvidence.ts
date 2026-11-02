/**
 * alertEvidence.ts — Dynamic evidence config builder for MultimodalEvidenceCharts
 * SRS v2.1.4: EXPERT-FR-003
 */
import type { InferredAlertItem } from '@/types/expert.types'

export interface EvidenceBarPoint { time: string; value: number; isAnomaly: boolean }

export interface EvidenceSource {
  title: string
  badge1: string
  badge2: string
  highlight?: string
  unit: string
  domain: [number, number]
  ticks: number[]
  refY: number
  refLabel: string
  data: EvidenceBarPoint[]
  anomalyTag: string
  barColor?: string
}

export interface AlertEvidenceConfig {
  windowLabel: string
  src1: EvidenceSource
  src2: EvidenceSource
  correlation: string
}

function getTimeSlots(createdAt: string): { slots: string[]; targetTime: string; windowLabel: string } {
  const d = new Date(createdAt)
  const baseTime = isNaN(d.getTime()) ? new Date() : d
  const slots: string[] = []
  for (let m = -30; m <= 30; m += 5) {
    const t = new Date(baseTime.getTime() + m * 60_000)
    slots.push(`${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`)
  }
  return {
    slots,
    targetTime: slots[6] ?? '16:00',
    windowLabel: `Khung giờ ±30 phút (${slots[0]} – ${slots[12]})`,
  }
}

export function buildAlertEvidence(alert: InferredAlertItem): AlertEvidenceConfig {
  const { slots, targetTime, windowLabel } = getTimeSlots(alert.created_at)
  const m = alert.metadata ?? {}

  if (alert.type === 'SENSOR_ANOMALY') {
    const metric = (m.sensor_type as string) || (m.metric as string) || 'Độ ẩm'
    const delta = (m.delta as number) ?? 12
    const v1 = [78, 78.5, 78, 77.8, 78.2, 78, 90, 78.5, 78.2, 78, 78.1, 78, 78.2]
    const v2 = [78.2, 78.1, 78.3, 78.2, 78.1, 78.2, 78.2, 78.3, 78.1, 78.2, 78.2, 78.1, 78.2]
    return {
      windowLabel,
      src1: {
        title: `Nguồn 1: Cảm biến ${metric} chính`,
        badge1: 'Chuẩn nền: 78% RH',
        badge2: `Ngưỡng lệch: ±5%`,
        highlight: `Đỉnh: 90% RH (+${delta}%)`,
        unit: ' %',
        domain: [0, 100],
        ticks: [0, 25, 50, 75, 100],
        refY: 83,
        refLabel: '83% RH',
        data: slots.map((time, i) => ({ time, value: v1[i] ?? 78, isAnomaly: i === 6 })),
        anomalyTag: `${targetTime} — 90% RH (nhảy vọt +${delta}% trong 10s)`,
      },
      src2: {
        title: 'Nguồn 2: Cảm biến đối chứng lân cận',
        badge1: 'Phun sương: Tắt (0%)',
        badge2: 'CB đối chứng: 78,2%',
        unit: ' %',
        domain: [0, 100],
        ticks: [0, 25, 50, 75, 100],
        refY: 78.2,
        refLabel: '78,2% RH',
        data: slots.map((time, i) => ({ time, value: v2[i] ?? 78.2, isAnomaly: false })),
        anomalyTag: `${targetTime} — Node đối chứng: 78,2% RH (ổn định) • Phun sương: TẮT`,
        barColor: '#8BAF2A',
      },
      correlation: `Node chính nhảy vọt (+${delta}% trong 10s) nhưng Node đối chứng cùng phòng vẫn phẳng lì (78,2%) và Phun sương đang TẮT (0%) → Khẳng định cảm biến chính bị lỗi hoặc nhiễu kết nối cục bộ.`,
    }
  }

  if (alert.type === 'MISTING_INEFFECTIVE' || (alert.type as string) === 'PUMP_DRY') {
    const v1 = [4.2, 4.1, 4.3, 4.2, 4.1, 4.2, 0.8, 0.8, 0.8, 4.2, 4.2, 4.1, 4.2]
    const v2 = [22, 20, 18, 16, 14, 10, 3, 3, 2, 2, 2, 2, 2]
    return {
      windowLabel,
      src1: {
        title: 'Nguồn 1: Dòng điện tải động cơ Bơm',
        badge1: 'Định mức: 4,2 A',
        badge2: 'Ngưỡng kẹt/hụt: < 2,5 A',
        highlight: 'Tải thực: 0,8 A',
        unit: ' A',
        domain: [0, 6],
        ticks: [0, 2, 4, 6],
        refY: 2.5,
        refLabel: '2,5 A',
        data: slots.map((time, i) => ({ time, value: v1[i] ?? 4.2, isAnomaly: i === 6 })),
        anomalyTag: `${targetTime} — 0,8 A (dòng sụt -81%, chạy không tải)`,
      },
      src2: {
        title: 'Nguồn 2: Mực nước bồn cấp',
        badge1: 'Mực nước: 3%',
        badge2: 'Ngưỡng cạn: 15%',
        unit: ' %',
        domain: [0, 100],
        ticks: [0, 25, 50, 75, 100],
        refY: 15,
        refLabel: 'Cạn 15%',
        data: slots.map((time, i) => ({ time, value: v2[i] ?? 20, isAnomaly: i === 6 })),
        anomalyTag: `${targetTime} — Mực nước bồn cạn: 3% (dưới ngưỡng 15%)`,
        barColor: '#3B82F6',
      },
      correlation: 'Bơm đang bật nhưng dòng điện tiêu thụ giảm sâu (0,8 A) đồng thời mực nước bồn cạn (3%) → Bơm đang chạy khô (hụt nước), nguy cơ cháy động cơ.',
    }
  }

  // Mặc định hoặc NOISE_ANOMALY
  const soundDb = (m.sound_db as number) ?? 74.5
  const soundThresh = soundDb - ((m.noise_margin as number) ?? 7.5)
  const v1 = [52, 54, 51, 53, 55, 53, soundDb, 56, 54, 52, 51, 53, 52]
  const v2 = [118, 122, 120, 115, 119, 121, 72, 110, 116, 118, 120, 119, 121]
  return {
    windowLabel,
    src1: {
      title: 'Nguồn 1: Cảm biến Âm thanh',
      badge1: 'Nền P90: 52 dB',
      badge2: `Ngưỡng: ${soundThresh} dB`,
      highlight: `Đỉnh: ${soundDb} dB`,
      unit: ' dB',
      domain: [0, 80],
      ticks: [0, 20, 40, 60, 80],
      refY: soundThresh,
      refLabel: `${soundThresh} dB`,
      data: slots.map((time, i) => ({ time, value: v1[i] ?? 52, isAnomaly: i === 6 })),
      anomalyTag: `${targetTime} — ${soundDb} dB (+${(soundDb - 52).toFixed(1)} dB trên nền P90)`,
    },
    src2: {
      title: 'Nguồn 2: Camera AI chim Ra/Vào',
      badge1: 'Chim vào (IN)',
      badge2: 'Chuẩn: 120 con',
      unit: ' con',
      domain: [0, 140],
      ticks: [0, 35, 70, 105, 140],
      refY: 120,
      refLabel: '120',
      data: slots.map((time, i) => ({ time, value: v2[i] ?? 120, isAnomaly: i === 6 })),
      anomalyTag: `${targetTime} — 72 con (−40% so với chuẩn)`,
      barColor: '#8BAF2A',
    },
    correlation: `Ồn tăng vọt (+${(soundDb - 52).toFixed(1)} dB trên nền P90) khi Loa tắt + Chim bay vào giảm đột ngột (−40%). Chim bay ra = 0 → Dấu hiệu đàn chim hoảng loạn ngoài giờ thu.`,
  }
}
