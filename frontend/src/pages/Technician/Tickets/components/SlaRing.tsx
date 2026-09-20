// SlaRing.tsx — SVG mini donut progress ring cho SLA countdown
// Visual Elevation: hiển thị % thời gian còn lại trực quan
import type { Ticket } from '@/types'
import { getSlaUrgency, formatSlaCountdown } from './ticketHelpers'

interface Props {
  ticket: Ticket
  /** Kích thước ring (px) */
  size?: number
}

export function SlaRing({ ticket, size = 36 }: Props) {
  const sla     = formatSlaCountdown(ticket)
  const urgency = getSlaUrgency(ticket)

  // Tính % thời gian còn lại (0..1)
  const now = Date.now()
  const due = ticket.sla_resolve_due_at ? new Date(ticket.sla_resolve_due_at).getTime() : 0
  const created = new Date(ticket.created_at).getTime()
  const totalMs = due - created
  const remainMs = due - now
  const pct = totalMs > 0 ? Math.max(0, Math.min(1, remainMs / totalMs)) : 0

  // SVG params
  const r = (size - 6) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct)

  const ringColor =
    urgency === 'breached' ? '#E13A3A' :
    urgency === 'critical' ? '#E13A3A' :
    urgency === 'warning'  ? '#F0813A' :
    '#27231F'

  const textColor =
    urgency === 'breached' ? 'text-alertRed font-semibold' :
    urgency === 'critical' ? 'text-alertRed' :
    urgency === 'warning'  ? 'text-climateOrange' :
    'text-warmGray'

  if (!ticket.sla_resolve_due_at || ticket.status === 'CLOSED') {
    return <span className="text-xs text-warmGray">{sla.text}</span>
  }

  return (
    <div className="flex items-center gap-2">
      <svg
        width={size}
        height={size}
        className={`shrink-0 -rotate-90 ${urgency === 'breached' ? 'animate-pulse-sla' : ''}`}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          className="text-graphite/10"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className={`text-sm ${textColor}`}>{sla.text}</span>
    </div>
  )
}
