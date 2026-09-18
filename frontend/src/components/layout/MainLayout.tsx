import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileDock from './MobileDock'
import Toast from '@/components/common/Toast'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useAlertNotifications } from '@/hooks/useAlertNotifications'

/** Main layout — sidebar (desktop) / dock nổi (mobile) + topbar + nội dung (FE_Design_Swiftlet.md §3) */
export default function MainLayout() {
  useAlertNotifications()

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        {/* pb-28 trên mobile để dock nổi không che nội dung cuối trang */}
        <main className="flex-1 overflow-y-auto bg-white px-4 pb-28 pt-5 lg:px-6 lg:pb-8 lg:pt-6">
          <div className="mx-auto w-full max-w-[1400px]">
            {/* Suspense đặt SÁT Outlet (không bọc ở App.tsx cấp cao hơn) — chunk
                lazy-load lần đầu chỉ thay skeleton trong khung nội dung này,
                Sidebar/TopBar/MobileDock không bị unmount nên không còn nháy
                toàn màn hình khi chuyển tab lần đầu. */}
            <Suspense fallback={<LoadingSkeleton className="h-40 w-full" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <MobileDock />
      <Toast />
    </div>
  )
}
