import { Outlet } from 'react-router-dom'
import ExpertScadaBanner from '@/components/features/expert/ExpertScadaBanner'

/**
 * Khung nội dung chung cho toàn bộ các trang của Chuyên gia nuôi yến:
 * - Luôn neo thanh banner đen SCADA Chuyên gia ở trên cùng kèm bộ chọn Zone 3 cấp.
 * - Loại bỏ z-0 stacking context trap để các drawer/modal con hiển thị nổi đúng z-index.
 * - Chống vỡ cuộn (w-full, flex flex-col).
 */
export default function ExpertPageShell() {
  return (
    <div className="flex w-full flex-1 flex-col gap-5 p-2">
      <ExpertScadaBanner />
      <div className="flex w-full flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
