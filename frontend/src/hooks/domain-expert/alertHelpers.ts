/**
 * alertHelpers.ts — Label maps, badge classes, evidence chart data builders
 * Dùng chung cho màn hình 02A & 02B — EXPERT-FR-003
 */
import type { ExpertVerdictStats } from '@/types/expert.types'
import { translated } from '@/i18n'

// ── Label / Badge maps ─────────────────────────────────────────────────────────
export const ALERT_TYPE_LABELS: Record<string, string> = translated({
  NOISE_ANOMALY: 'Ồn bất thường',
  SENSOR_ANOMALY: 'Cảm biến bất thường',
  FORECAST_BREACH: 'Dự báo vượt ngưỡng độ ẩm',
  LOW_RETURN_RATE: 'Giảm tỉ lệ chim về tổ',
})

export const SEVERITY_LABELS: Record<string, string> = translated({
  CRITICAL: 'Khẩn cấp',
  HIGH: 'Cao',
  MEDIUM: 'Trung bình',
  LOW: 'Thường',
})

export const SEVERITY_BADGE_CLASS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border border-red-300',
  HIGH: 'bg-orange-100 text-orange-700 border border-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  LOW: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
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
