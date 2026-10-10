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

  const textColor =
    urgency === 'breached' ? 'text-alertRed font-bold' :
    urgency === 'critical' ? 'text-alertRed font-medium' :
    urgency === 'warning'  ? 'text-climateOrange font-medium' :
    'text-charcoal font-medium'

  // Ticket CLOSED hoặc không có SLA → hiển thị text tĩnh
  if (!ticket.sla_resolve_due_at || ticket.status === 'CLOSED') {
    return <span className={`text-sm font-medium ${textColor}`}>{sla.text}</span>
  }

  return (
    <span className={`text-sm font-medium ${textColor} ${urgency === 'breached' ? 'animate-pulse-sla' : ''}`}>
      {sla.text}
    </span>
  )
}
