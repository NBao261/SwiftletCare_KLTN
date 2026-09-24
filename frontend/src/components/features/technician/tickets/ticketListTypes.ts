// ticketListTypes.ts — Shared types, constants và helper cho Technician Ticket List
// Đặt ở đây để các component con (Toolbar, Table, TicketTableRow) import chung,
// tránh khai báo lặp ở mỗi file.
import type { Ticket, TicketStatus, TicketType } from '@/types'
import { TICKET_TYPE_LABEL, STATUS_LABEL } from '@/constants/tickets'

export const PAGE_SIZE = 12 // số ticket mỗi trang

export type TechTab  = 'mine' | 'in_progress' | 'overdue'
export type SortKey  = 'created_at' | 'sla' | 'status'
export type SortDir  = 'asc' | 'desc'
export type ViewMode = 'table' | 'card'

export const TABS: { id: TechTab; label: string; icon: string }[] = [
  { id: 'mine',        label: 'Tất cả của tôi', icon: '📋' },
  { id: 'in_progress', label: 'Đang xử lý',     icon: '⚙️' },
  { id: 'overdue',     label: 'Quá hạn SLA',    icon: '🔴' },
]

export const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 }
export const STATUS_ORDER: Record<string, number>   = {
  NEW: 0, IN_PROGRESS: 1, AWAITING_FIELD_CONFIRMATION: 2, CLOSED: 3,
}

export const PRIORITY_DOT_CLS: Record<string, string> = {
  P1: 'bg-alertRed ring-alertRed/20',
  P2: 'bg-climateOrange ring-climateOrange/20',
  P3: 'bg-warmGray ring-warmGray/20',
}

export const STATUS_DOT_CLS: Record<string, string> = {
  NEW: 'bg-charcoal',
  IN_PROGRESS: 'bg-climateOrange',
  AWAITING_FIELD_CONFIRMATION: 'bg-limeMist',
  CLOSED: 'bg-warmGray',
}

/** Sort danh sách ticket theo key + direction */
export function sortTickets(tickets: Ticket[], key: SortKey, dir: SortDir): Ticket[] {
  return [...tickets].sort((a, b) => {
    let cmp = 0
    if (key === 'status') {
      cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    } else if (key === 'sla') {
      const ta = a.sla_resolve_due_at ? new Date(a.sla_resolve_due_at).getTime() : Infinity
      const tb = b.sla_resolve_due_at ? new Date(b.sla_resolve_due_at).getTime() : Infinity
      cmp = ta - tb
    } else {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

/** Tìm kiếm trong danh sách ticket theo search string */
export function filterBySearch(tickets: Ticket[], search: string): Ticket[] {
  if (!search.trim()) return tickets
  const q = search.toLowerCase()
  return tickets.filter(t =>
    TICKET_TYPE_LABEL[t.type as TicketType]?.toLowerCase().includes(q) ||
    t.notes.some(n => n.content.toLowerCase().includes(q)) ||
    STATUS_LABEL[t.status]?.toLowerCase().includes(q),
  )
}

/** Lọc ticket theo status (dùng khi client-side filter cần thiết — tab overdue) */
export function filterByStatus(tickets: Ticket[], status: TicketStatus | ''): Ticket[] {
  if (!status) return tickets
  return tickets.filter(t => t.status === status)
}
