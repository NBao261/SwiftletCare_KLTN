import type { TicketSatChecklist, TicketStatus } from '@/types'

/**
 * Màu badge trạng thái ở các màn ticket của Admin — cố ý KHÁC họ màu cột Ưu tiên (đỏ/cam/xám
 * của PRIORITY_TONE) để 2 cột đứng cạnh nhau không lẫn: đậm → nhạt theo mức "cần làm".
 * Truyền làm className cho <Badge> (cn/tailwind-merge ghi đè màu tone mặc định).
 * Không sửa STATUS_TONE dùng chung vì màn Technician/Farm Owner vẫn dùng.
 */
export const STATUS_BADGE_CLASS: Record<TicketStatus, string> = {
  NEW: 'bg-orange-100 text-orange-700',                                   // chờ xử lý — cam nhạt, cần chú ý
  IN_PROGRESS: 'bg-accent-300 text-charcoal',                             // đang chạy — xanh chanh
  AWAITING_FIELD_CONFIRMATION: 'border border-charcoal/30 bg-white text-graphite', // đang chờ — viền, chưa "đặc"
  CLOSED: 'bg-warmGray/15 text-warmGray',                                 // đã kết thúc — chìm
}

/** Checklist nghiệm thu lắp đặt/bảo trì (Technician xác nhận) — nhãn hiển thị trên AdminTicketDetailPage */
export const SAT_LABEL: Record<keyof TicketSatChecklist, string> = {
  modbus_addresses_ok: '5 địa chỉ Modbus phản hồi đúng',
  camera_rtsp_ok: 'Camera RTSP ổn định',
  lte_connection_ok: 'Kết nối 4G ổn định',
  relay_test_ok: 'Relay đóng/ngắt đúng',
}
