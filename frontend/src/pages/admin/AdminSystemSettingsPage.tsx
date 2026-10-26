// ADMIN — Cấu hình mặc định hệ thống: ngưỡng môi trường (SYSTEM-FR-002, nguồn cho ENV-FR-020, xem
// ThresholdsCard/ThresholdsEditModal).
// Cùng ngôn ngữ các trang Admin khác: card trắng có tiêu đề + hàng ô StatTile icon xám, rộng hết trang.
// Chỉ ĐỌC — bấm "Chỉnh sửa" mới mở popup để sửa + lưu/khôi phục mặc định gốc.
// Tiêu đề trang lấy từ menu (AppHeader tự tra), không lặp lại trong nội dung.
import ThresholdsCard from '@/components/features/admin/system/ThresholdsCard'

export default function AdminSystemSettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <ThresholdsCard />
    </div>
  )
}
