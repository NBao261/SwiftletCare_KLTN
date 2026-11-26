// alertHelpers.ts: Label maps, badge classes, evidence chart data builders Dùng chung cho màn hình 02A & 02B
import type { ExpertVerdictStats } from '@/types/expert.types'
import { translated } from '@/i18n'

// Label / Badge maps
export const ALERT_TYPE_LABELS: Record<string, string> = translated({
  NOISE_ANOMALY: 'Tiếng ồn bất thường',
  SENSOR_ANOMALY: 'Cảm biến bất thường',
  FORECAST_BREACH: 'Sắp vượt ngưỡng',
  LOW_RETURN_RATE: 'Tỷ lệ chim về thấp',
})

// Verdict stats text summary
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
