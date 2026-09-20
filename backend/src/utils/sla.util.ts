import { BadRequestError } from '@/utils/appError.util'
import type { SlaConfig, TicketPriority } from '@/types'

export const PRIORITIES: TicketPriority[] = ['P1', 'P2', 'P3']

/** TICKET-FR-006 — giá trị đề xuất trong SRS, dùng khi Admin chưa cấu hình gì */
export const DEFAULT_SLA: SlaConfig = {
  P1: { response_hours: 0.5, resolve_hours: 4 },
  P2: { response_hours: 4, resolve_hours: 24 },
  P3: { response_hours: 24, resolve_hours: 72 },
}

export function assertValidSla(sla: SlaConfig): void {
  for (const priority of PRIORITIES) {
    const level = sla[priority]
    if (!level) throw BadRequestError(`Thiếu cấu hình SLA cho mức ${priority}`)
    if (!(level.response_hours > 0) || !(level.resolve_hours > 0)) {
      throw BadRequestError(`SLA ${priority} phải lớn hơn 0 giờ`)
    }
    if (level.response_hours > level.resolve_hours) {
      throw BadRequestError(`SLA ${priority}: hạn phản hồi không được muộn hơn hạn xử lý`)
    }
  }
}

/** Chỉ giữ đúng 3 mức ưu tiên và 2 trường giờ — chặn body chèn field lạ */
export function pickSla(input: Record<string, unknown>, current: SlaConfig): SlaConfig {
  const merged = { ...current }
  for (const priority of PRIORITIES) {
    const level = input[priority] as Record<string, unknown> | undefined
    if (!level) continue
    merged[priority] = {
      response_hours: level.response_hours !== undefined ? Number(level.response_hours) : current[priority].response_hours,
      resolve_hours:  level.resolve_hours  !== undefined ? Number(level.resolve_hours)  : current[priority].resolve_hours,
    }
  }
  return merged
}
