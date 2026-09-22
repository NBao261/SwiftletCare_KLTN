// ticketHelpers.ts — shared pure helpers for Technician Ticket pages
// No React imports → fully tree-shakeable
import type { Ticket } from '@/types'

/**
 * Ticket có VI PHẠM SLA không?
 * Fix: Ticket CLOSED không so sánh với Date.now() — chỉ dùng cờ is_sla_breached từ backend.
 * Lý do: ticket CLOSED hợp lệ luôn có sla_resolve_due_at < now, không phải vi phạm hiện tại.
 */
export function isSlaBreached(ticket: Ticket): boolean {
  if (!ticket.sla_resolve_due_at) return false
  if (ticket.status === 'CLOSED') return ticket.is_sla_breached  // Chỉ tin backend khi đã đóng
  return ticket.is_sla_breached || new Date(ticket.sla_resolve_due_at) < new Date()
}

/**
 * Đếm ngược SLA — Fix: ticket CLOSED hiển thị trạng thái lúc đóng, không so sánh với now
 */
export function formatSlaCountdown(ticket: Ticket): { text: string; breached: boolean } {
  if (!ticket.sla_resolve_due_at) return { text: '—', breached: false }

  // Ticket CLOSED: dựa theo cờ backend, không tính thêm giờ trễ mới
  if (ticket.status === 'CLOSED') {
    return ticket.is_sla_breached
      ? { text: 'Vi phạm SLA', breached: true }
      : { text: 'Đúng hạn', breached: false }
  }

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

/** Trả về mức độ urgent của SLA — dùng để xác định màu sắc hiển thị */
export type SlaUrgency = 'ok' | 'warning' | 'critical' | 'breached' | 'closed'

/**
 * Fix: ticket CLOSED → urgency 'closed' (không highlight đỏ)
 */
export function getSlaUrgency(ticket: Ticket): SlaUrgency {
  if (!ticket.sla_resolve_due_at) return 'ok'
  // Ticket CLOSED: không tô màu urgent dựa theo thời gian hiện tại
  if (ticket.status === 'CLOSED') return ticket.is_sla_breached ? 'breached' : 'closed'
  const diff = new Date(ticket.sla_resolve_due_at).getTime() - Date.now()
  if (diff < 0)           return 'breached'
  if (diff < 3_600_000)   return 'critical'  // < 1 giờ
  if (diff < 7_200_000)   return 'warning'   // < 2 giờ
  return 'ok'
}

// ── SAT Checklist ───────────────────────────────────────────────────────────────────────
// Nguồn sự thật duy nhất cho cả SATChecklist (Ticket detail) và Step6SAT (Onboarding
// wizard). Trước đây khai báo trùng ở cả 2 file; đưa về đây để business thay
// đổi checklist chỉ cần sửa 1 chỗ.
import type { TicketSatChecklist } from '@/types'

export interface SatItem {
  key: keyof TicketSatChecklist
  label: string
  subLabel: string
  /** Chỉ hiển thị khi thiết bị là CAMERA_NODE */
  cameraOnly?: boolean
}

export const SAT_ITEMS: SatItem[] = [
  { key: 'modbus_addresses_ok', label: 'Modbus RS485',    subLabel: '5 địa chỉ phản hồi OK' },
  { key: 'camera_rtsp_ok',      label: 'Camera RTSP',     subLabel: 'Stream ổn định ≥ 30 giây', cameraOnly: true },
  { key: 'lte_connection_ok',   label: 'Kết nối 4G/LTE',  subLabel: 'MQTT broker OK, latency < 200ms' },
  { key: 'relay_test_ok',       label: 'Relay đóng/ngắt', subLabel: 'Tất cả IN1–IN4 đáp ứng lệnh' },
]
