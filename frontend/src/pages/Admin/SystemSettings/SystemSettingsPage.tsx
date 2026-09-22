// ADMIN — Cấu hình mặc định hệ thống: ngưỡng môi trường (SYSTEM-FR-002, nguồn cho
// ENV-FR-020, xem ThresholdsCard/ThresholdsEditModal) + SLA xử lý ticket
// (TICKET-FR-006, SLA-NFR-001, xem SlaCard/SlaEditModal). 2 cột: trái = card tối
// (charcoal/trắng), phải = card sáng lime (giống màu pill nav active, charcoal
// chữ) — cả 2 chỉ ĐỌC, bấm "Chỉnh sửa" mới mở popup trắng/đen (Modal chuẩn) để
// sửa + lưu/khôi phục mặc định gốc. constants.ts/LastUpdatedFooter.tsx dùng chung cho cả 2 card.
import ThresholdsCard from './ThresholdsCard'
import SlaCard from './SlaCard'

export default function SystemSettingsPage() {
  return (
    // flex-1 để trang chiếm hết chiều cao khung trắng của MainLayout (mặc định co
    // theo nội dung, để trống mảng lớn phía dưới khi 2 card ngắn hơn viewport).
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <p className="label-caption">Quản trị hệ thống</p>
        <h1 className="text-h1 tracking-tight text-charcoal">Cấu hình mặc định</h1>
        <p className="mt-1 text-sm text-warmGray">
          Áp dụng cho toàn hệ thống khi farm/zone chưa tự cấu hình riêng — ảnh hưởng trực tiếp hành vi tự động và thời hạn xử lý ticket.
        </p>
      </div>

      {/* auto-rows-fr: hàng grid duy nhất giãn hết phần cao còn lại (nhờ flex-1 ở trên) thay vì chỉ cao bằng nội dung */}
      <div className="grid flex-1 grid-cols-1 gap-4 lg:auto-rows-fr lg:grid-cols-2">
        <ThresholdsCard />
        <SlaCard />
      </div>
    </div>
  )
}
