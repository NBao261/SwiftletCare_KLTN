import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileDock from './MobileDock'
import Toast from '@/components/common/Toast'

/** Main layout — sidebar (desktop) / dock nổi (mobile) + topbar + nội dung (FE_Design_Swiftlet.md §3) */
export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        {/* pb-28 trên mobile để dock nổi không che nội dung cuối trang */}
        <main className="flex-1 overflow-y-auto bg-white px-4 pb-28 pt-5 lg:px-6 lg:pb-8 lg:pt-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileDock />
      <Toast />
    </div>
  )
}
