// ticketListTypes.ts — Shared types, constants và helper cho Technician Ticket List
// Đặt ở đây để các component con (Toolbar, Table, TicketTableRow) import chung,
// tránh khai báo lặp ở mỗi file.
import type { Ticket, TicketStatus, TicketType } from '@/types'
import { TICKET_TYPE_LABEL, STATUS_LABEL } from '@/constants/tickets'
import { ChevronsUp, ChevronUp, Minus, type LucideIcon } from 'lucide-react'

export const PAGE_SIZE = 12 // số ticket mỗi trang

export type TechTab  = 'mine' | 'in_progress' | 'overdue' | 'unassigned'
export type SortKey  = 'created_at' | 'sla' | 'status'
export type SortDir  = 'asc' | 'desc'


export const TABS: { id: TechTab; label: string; icon: string }[] = [
  { id: 'mine',        label: 'Tất cả của tôi', icon: '📋' },
  { id: 'in_progress', label: 'Đang xử lý',     icon: '⚙️' },
  { id: 'overdue',     label: 'Quá hạn SLA',    icon: '🔴' },
  { id: 'unassigned',  label: 'Hàng đợi chung', icon: '📥' },
]

export const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 }
export const STATUS_ORDER: Record<string, number>   = {
  NEW: 0, IN_PROGRESS: 1, AWAITING_FIELD_CONFIRMATION: 2, CLOSED: 3,
}

// Priority: dùng HÌNH KHỐI (icon) thay vì chấm màu → không trùng ngôn ngữ thị giác với badge Status
export const PRIORITY_ICON: Record<string, LucideIcon> = {
  P1: ChevronsUp,
  P2: ChevronUp,
  P3: Minus,
}

export const PRIORITY_TEXT_CLS: Record<string, string> = {
  P1: 'text-alertRed',
  P2: 'text-climateOrange',
  P3: 'text-warmGray',
}

// Chấm màu phân biệt mức ưu tiên (P1 đỏ, P2 cam, P3 xám)
export const PRIORITY_DOT_CLS: Record<string, string> = {
  P1: 'bg-alertRed',
  P2: 'bg-climateOrange',
  P3: 'bg-warmGray',
}

// Badge trạng thái: nền pastel + chữ đậm cùng tông, KHÔNG viền — khớp STATUS_TONE (constants/tickets)
export const STATUS_BADGE_CLS: Record<string, string> = {
  NEW: 'bg-alertRed/10 text-alertRed',
  IN_PROGRESS: 'bg-climateOrange/10 text-climateOrange',
  AWAITING_FIELD_CONFIRMATION: 'bg-sky-500/10 text-sky-600',
  CLOSED: 'bg-warmGray/10 text-warmGray',
}

/** Sort danh sách ticket theo key + direction */
export function sortTickets(tickets: Ticket[], key: SortKey, dir: SortDir): Ticket[] {
  return [...tickets].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime()
    const timeB = new Date(b.created_at).getTime()
    const slaA = a.sla_resolve_due_at ? new Date(a.sla_resolve_due_at).getTime() : Infinity
    const slaB = b.sla_resolve_due_at ? new Date(b.sla_resolve_due_at).getTime() : Infinity

    let cmp = 0
    if (key === 'status') {
      cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      if (cmp === 0) {
        cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) // Tie-breaker 1: P1 trước
        if (cmp === 0) cmp = slaA - slaB // Tie-breaker 2: Urgent SLA first
        if (cmp === 0) cmp = timeA - timeB // Tie-breaker 3: Oldest first
      }
    } else if (key === 'sla') {
      cmp = slaA - slaB
      if (cmp === 0) cmp = timeA - timeB
    } else {
      cmp = timeA - timeB
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
