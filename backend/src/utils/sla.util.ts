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

  // P1 gấp nhất (TICKET-FR-003): mức gấp hơn mà hạn dài hơn thì priority mất nghĩa — sự cố
  // P1 được chờ lâu hơn P3, còn Router/escalate vẫn đối xử như việc khẩn
  for (let i = 1; i < PRIORITIES.length; i++) {
    const [higher, lower] = [PRIORITIES[i - 1], PRIORITIES[i]]
    for (const field of ['response_hours', 'resolve_hours'] as const) {
      if (sla[higher][field] > sla[lower][field]) {
        const label = field === 'response_hours' ? 'phản hồi' : 'xử lý'
        throw BadRequestError(`SLA ${higher}: hạn ${label} không được dài hơn mức ${lower} (mức gấp hơn phải có hạn ngắn hơn hoặc bằng)`)
      }
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
