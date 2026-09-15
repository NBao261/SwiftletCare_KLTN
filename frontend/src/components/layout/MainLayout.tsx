import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Toast from '@/components/common/Toast'

/** Main layout wrapper – sidebar + topbar + content area (FE_Design_Swiftlet.md §3.C) */
export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-white p-6">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  )
}
