// ticketHelpers.ts — shared pure helpers for Technician Ticket pages
// No React imports → fully tree-shakeable
import type { Ticket } from '@/types'

export function isSlaBreached(ticket: Ticket): boolean {
  if (!ticket.sla_resolve_due_at) return false
  return ticket.is_sla_breached || new Date(ticket.sla_resolve_due_at) < new Date()
}

export function formatSlaCountdown(ticket: Ticket): { text: string; breached: boolean } {
  if (!ticket.sla_resolve_due_at) return { text: '—', breached: false }
  const diff = new Date(ticket.sla_resolve_due_at).getTime() - Date.now()
  const breached = diff < 0
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const text = breached ? `+${h}h ${m}m vi phạm` : `Còn ${h}h ${m}m`
  return { text, breached }
}

export function assigneeName(assigned: Ticket['assigned_to']): string {
  return typeof assigned === 'object' && assigned ? assigned.full_name : 'Chưa gán'
}
