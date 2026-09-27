// ADMIN — Cấu hình mặc định hệ thống: ngưỡng môi trường (SYSTEM-FR-002, nguồn cho
// ENV-FR-020, xem ThresholdsCard/ThresholdsEditModal) + SLA xử lý ticket
// (TICKET-FR-006, SLA-NFR-001, xem SlaCard/SlaEditModal). 2 cột: trái = card tối
// (charcoal/trắng), phải = card sáng lime (giống màu pill nav active, charcoal
// chữ) — cả 2 chỉ ĐỌC, bấm "Chỉnh sửa" mới mở popup trắng/đen (Modal chuẩn) để
// sửa + lưu/khôi phục mặc định gốc. system.constants.ts dùng chung cho cả 2 card.
// Tiêu đề trang lấy từ menu (AppHeader tự tra), không lặp lại trong nội dung.
import ThresholdsCard from '@/components/features/admin/system/ThresholdsCard'
import SlaCard from '@/components/features/admin/system/SlaCard'

export default function AdminSystemSettingsPage() {
  return (
    // Không ép chiếm hết chiều cao viewport — card co theo nội dung, khung trắng của
    // MainLayout cũng ngắn lại. auto-rows-fr chỉ để 2 card luôn cao bằng nhau.
    <div className="grid grid-cols-1 gap-4 lg:auto-rows-fr lg:grid-cols-2">
      <ThresholdsCard />
      <SlaCard />
    </div>
  )
}
