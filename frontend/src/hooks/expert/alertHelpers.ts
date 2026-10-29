/**
 * alertHelpers.ts — Label maps, badge classes, evidence chart data builders
 * Dùng chung cho màn hình 02A & 02B — EXPERT-FR-003
 */
import type { ExpertVerdictStats } from '@/types/expert.types'

// ── Label / Badge maps ─────────────────────────────────────────────────────────
export const ALERT_TYPE_LABELS: Record<string, string> = {
  NOISE_ANOMALY: 'Ồn bất thường',
  SENSOR_ANOMALY: 'Cảm biến bất thường',
  FORECAST_BREACH: 'Dự báo vượt ngưỡng độ ẩm',
  LOW_RETURN_RATE: 'Giảm tỉ lệ chim về tổ',
  MISTING_INEFFECTIVE: 'Phun sương không hiệu quả', // PUMP_DRY → MISTING_INEFFECTIVE (SRS 3.1.0)
}

export const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: 'Khẩn cấp',
  HIGH: 'Cao',
  MEDIUM: 'Cao',
  LOW: 'Thường',
}

export const SEVERITY_BADGE_CLASS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border border-red-300',
  HIGH: 'bg-orange-100 text-orange-700 border border-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  LOW: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
}

// ── Evidence chart data builders ───────────────────────────────────────────────
export interface EvidenceBarPoint { time: string; value: number; isAnomaly: boolean }

export function buildSoundEvidenceData(_createdAt: string): EvidenceBarPoint[] {
  const slots = ['17:15','17:20','17:25','17:30','17:35','17:40','17:45','17:50','17:55','18:00','18:05','18:10','18:15']
  const values = [52, 54, 51, 53, 55, 53, 74.5, 56, 54, 52, 51, 53, 52]
  return slots.map((time, i) => ({ time, value: values[i], isAnomaly: i === 6 }))
}

export function buildBirdCountEvidenceData(): EvidenceBarPoint[] {
  const slots = ['17:15','17:20','17:25','17:30','17:35','17:40','17:45','17:50','17:55','18:00','18:05','18:10','18:15']
  const values = [118, 122, 120, 115, 119, 121, 72, 110, 116, 118, 120, 119, 121]
  return slots.map((time, i) => ({ time, value: values[i], isAnomaly: i === 6 }))
}

// ── Verdict stats text summary ─────────────────────────────────────────────────
export function buildVerdictStatsSummary(stats: ExpertVerdictStats[]): string {
  if (!stats.length) return ''
  const evaluated = stats.filter(s => (s.confirmed + s.rejected) > 0)
  if (evaluated.length === 0) return ''
  return evaluated.map(s => {
    const total = s.confirmed + s.rejected
    const pct = s.confirmedPct ?? Math.round((s.confirmed / total) * 100)
    return `${ALERT_TYPE_LABELS[s.type] ?? s.type} ${pct}%`
  }).join(' • ')
}
