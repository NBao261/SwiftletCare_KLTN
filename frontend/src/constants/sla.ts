import type { SlaConfig, TicketPriority } from '@/types'

/** Thứ tự hiển thị P1 (khẩn cấp nhất) → P3 (thấp nhất), khớp backend `PRIORITIES` (sla.util.ts) */
export const SLA_PRIORITIES: TicketPriority[] = ['P1', 'P2', 'P3']

/** Nhãn ý nghĩa mức ưu tiên — SRS §Thuật ngữ "P1 khẩn cấp nhất → P3 thấp nhất" */
export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  P1: 'Khẩn cấp',
  P2: 'Cao',
  P3: 'Thường',
}

/**
 * Giá trị đề xuất trong SRS (TICKET-FR-006) — PHẢI khớp backend/src/utils/sla.util.ts
 * `DEFAULT_SLA`. Backend không có endpoint reset riêng, nên "Khôi phục mặc định gốc"
 * = PUT /system/settings/sla với đúng 6 giá trị này.
 */
export const FACTORY_DEFAULT_SLA: SlaConfig = {
  P1: { response_hours: 0.5, resolve_hours: 4 },
  P2: { response_hours: 4, resolve_hours: 24 },
  P3: { response_hours: 24, resolve_hours: 72 },
}

/** Chuỗi rỗng/khoảng trắng → NaN thay vì 0 như `Number('')` — lý do có hàm này */
export function parseSlaInput(raw: string): number {
  return raw.trim() === '' ? NaN : Number(raw)
}

/**
 * Validate form SLA phía client — cùng luật với `assertValidSla` backend: giờ > 0,
 * hạn phản hồi không được muộn hơn hạn xử lý. Trả map lỗi khoá theo `P1.response_hours`
 * kiểu chuỗi (không dùng union literal để tránh lặp lại tổ hợp priority×field).
 */
export function validateSla(sla: SlaConfig): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const p of SLA_PRIORITIES) {
    const { response_hours, resolve_hours } = sla[p]
    if (!Number.isFinite(response_hours) || response_hours <= 0) errors[`${p}.response_hours`] = 'Chưa nhập hoặc phải lớn hơn 0'
    if (!Number.isFinite(resolve_hours) || resolve_hours <= 0) errors[`${p}.resolve_hours`] = 'Chưa nhập hoặc phải lớn hơn 0'
    if (!errors[`${p}.response_hours`] && !errors[`${p}.resolve_hours`] && response_hours > resolve_hours) {
      errors[`${p}.resolve_hours`] = 'Hạn xử lý phải ≥ hạn phản hồi'
    }
  }
  return errors
}
