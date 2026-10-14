// ADMIN — Cấu hình mặc định hệ thống: ngưỡng môi trường (SYSTEM-FR-002, nguồn cho ENV-FR-020, xem
// ThresholdsCard/ThresholdsEditModal) + SLA xử lý ticket (TICKET-FR-006, SLA-NFR-001, xem SlaCard/SlaEditModal).
// Cùng ngôn ngữ các trang Admin khác: mỗi khối 1 card trắng có tiêu đề + hàng ô StatTile icon xám, xếp chồng rộng hết
// trang. Cả 2 chỉ ĐỌC — bấm "Chỉnh sửa" mới mở popup để sửa + lưu/khôi phục mặc định gốc.
// Tiêu đề trang lấy từ menu (AppHeader tự tra), không lặp lại trong nội dung.
import ThresholdsCard from '@/components/features/admin/system/ThresholdsCard'
import SlaCard from '@/components/features/admin/system/SlaCard'

export default function AdminSystemSettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <ThresholdsCard />
      <SlaCard />
    </div>
  )
}
