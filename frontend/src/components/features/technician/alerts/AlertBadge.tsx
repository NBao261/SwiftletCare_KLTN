import { Badge, type BadgeTone } from '@/components/ui'
import type { AlertSeverity } from '@/types'

const SEVERITY_TONE: Record<AlertSeverity, BadgeTone> = {
  CRITICAL: 'critical',
  HIGH:     'critical',
  MEDIUM:   'warning',
  LOW:      'neutral',
}

/** AlertBadge – badge mức độ cảnh báo (ALERT-FR-001) */
export default function AlertBadge({ severity }: { severity: AlertSeverity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{severity}</Badge>
}
