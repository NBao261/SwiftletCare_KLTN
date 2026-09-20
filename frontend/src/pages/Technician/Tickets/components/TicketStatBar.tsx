// TicketStatBar.tsx — 3 stat cards hiển thị tổng quan tickets của Technician
import type { Ticket } from '@/types'
import { isSlaBreached } from './ticketHelpers'

interface Props {
  tickets: Ticket[]
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 rounded-2xl bg-white p-5 shadow-sm ${accent ? 'ring-2 ring-alertRed/25' : ''}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-warmGray">{label}</span>
      <span className={`text-3xl font-bold ${accent ? 'text-alertRed' : 'text-charcoal'}`}>{value}</span>
    </div>
  )
}

export function TicketStatBar({ tickets }: Props) {
  const statsOpen     = tickets.filter(t => t.status !== 'CLOSED').length
  const statsBreached = tickets.filter(isSlaBreached).length
  const statsAwaiting = tickets.filter(t => t.status === 'AWAITING_FIELD_CONFIRMATION').length

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard label="Đang mở"      value={statsOpen} />
      <StatCard label="Quá hạn SLA"  value={statsBreached} accent={statsBreached > 0} />
      <StatCard label="Chờ xác nhận" value={statsAwaiting} />
    </div>
  )
}
