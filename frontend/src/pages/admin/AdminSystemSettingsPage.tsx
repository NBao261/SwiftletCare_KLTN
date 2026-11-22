// Cấu hình mặc định hệ thống: chỉ đọc, "Chỉnh sửa" mới mở popup
import ThresholdsCard from '@/components/features/admin/system/ThresholdsCard'

export default function AdminSystemSettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <ThresholdsCard />
    </div>
  )
}
