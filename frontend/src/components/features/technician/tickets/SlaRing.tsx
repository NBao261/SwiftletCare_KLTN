// SlaRing.tsx — chữ đếm ngược SLA + thanh tiến độ mảnh (thời gian đã tiêu hao)
// Màu thanh theo mức khẩn: ổn (accent) → cảnh báo (cam) → khẩn/trễ (đỏ). Chữ luôn đi kèm nên không phụ thuộc riêng màu.
import type { Ticket } from '@/types'
import { getSlaUrgency, getSlaProgress, formatSlaCountdown } from './ticketHelpers'

interface Props {
  ticket: Ticket
  /** Giữ để tương thích chỗ gọi cũ (không còn dùng) */
  size?: number
}

export function SlaRing({ ticket }: Props) {
  const sla     = formatSlaCountdown(ticket)
  const urgency = getSlaUrgency(ticket)
  const progress = getSlaProgress(ticket)

  const textColor =
    urgency === 'breached' ? 'text-alertRed font-bold' :
    urgency === 'critical' ? 'text-alertRed font-medium' :
    urgency === 'warning'  ? 'text-climateOrange font-medium' :
    'text-charcoal font-medium'


  // Ticket CLOSED hoặc không có SLA → hiển thị text tĩnh
  if (progress === null) {
    return <span className={`text-sm font-medium ${textColor}`}>{sla.text}</span>
  }

  return (
    <span className={`text-sm font-medium ${textColor} ${urgency === 'breached' ? 'animate-pulse-sla motion-reduce:animate-none' : ''}`}>
      {sla.text}
    </span>
  )
}
