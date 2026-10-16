import type { TicketSatChecklist, TicketStatus } from '@/types'
import { translated } from '@/i18n'

/**
 * Màu badge trạng thái ở các màn ticket của Admin — cố ý KHÁC họ màu cột Ưu tiên (đỏ/cam/xám
 * của PRIORITY_TONE) để 2 cột đứng cạnh nhau không lẫn: đậm → nhạt theo mức "cần làm".
 * Truyền làm className cho <Badge> (cn/tailwind-merge ghi đè màu tone mặc định).
 * Không sửa STATUS_TONE dùng chung vì màn Technician/Farm Owner vẫn dùng.
 */
export const STATUS_BADGE_CLASS: Record<TicketStatus, string> = {
  NEW: 'bg-infoBlue/15 text-infoBlue',                                   // mới, chờ tiếp nhận — token infoBlue (cùng màu "Mới" bảng nhật ký Dashboard), khác đỏ/cam của Ưu tiên
  IN_PROGRESS: 'bg-limeMist text-charcoal',                             // đang chạy — xanh LIME MIST như Badge positive, menu đang chọn
  AWAITING_FIELD_CONFIRMATION: 'border border-charcoal/30 bg-white text-graphite', // đang chờ — viền, chưa "đặc"
  CLOSED: 'bg-warmGray/15 text-warmGray',                                 // đã kết thúc — chìm
}

/** Checklist nghiệm thu lắp đặt/bảo trì (Technician xác nhận) — nhãn hiển thị trên AdminTicketDetailPage */
export const SAT_LABEL: Record<keyof TicketSatChecklist, string> = translated({
  modbus_addresses_ok: '5 địa chỉ Modbus phản hồi đúng',
  camera_rtsp_ok: 'Camera RTSP ổn định',
  lte_connection_ok: 'Kết nối 4G ổn định',
  relay_test_ok: 'Relay đóng/ngắt đúng',
})
