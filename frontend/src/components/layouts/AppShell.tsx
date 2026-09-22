import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import AppSidebar, { type MenuItem, type MenuSection } from '@/components/layouts/AppSidebar'
import AppHeader from '@/components/layouts/AppHeader'
import Toast from '@/components/common/Toast'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useAlertNotifications } from '@/hooks/shared/useAlertNotifications'

/**
 * Khung ứng dụng dùng chung — sidebar (desktop) / dock nổi (mobile) + header +
 * nội dung (FE_Design_Claude.md §4). Cả 4 role dùng đúng khung này, khác nhau
 * chỉ ở menu do `<Role>Layout.tsx` truyền xuống, nên sửa khung một lần là cả 4
 * role cùng đổi.
 */
export default function AppShell({
  menuSections,
  dockItems,
}: {
  menuSections: MenuSection[]
  dockItems: MenuItem[]
}) {
  useAlertNotifications()

  return (
    <div className="flex h-screen overflow-hidden bg-stone">
      <AppSidebar menuSections={menuSections} dockItems={dockItems} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader menuSections={menuSections} />
        {/* pb-28 trên mobile để dock nổi không che nội dung cuối trang */}
        <main className="flex-1 overflow-y-auto bg-stone px-4 pb-28 pt-2 lg:px-6 lg:pb-8 lg:pt-3">
          <div className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col rounded-[24px] border border-warmGray/20 bg-white p-6 shadow-card lg:p-8">
            {/* Suspense đặt SÁT Outlet (không bọc ở App.tsx cấp cao hơn) — chunk
                lazy-load lần đầu chỉ thay skeleton trong khung nội dung này,
                sidebar/header/dock không bị unmount nên không còn nháy toàn
                màn hình khi chuyển tab lần đầu. */}
            <Suspense fallback={<LoadingSkeleton className="h-40 w-full" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <Toast />
    </div>
  )
}
