import { Suspense } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { useBreadcrumbStore } from '@/stores/breadcrumbStore'
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
  const back = useBreadcrumbStore(s => s.back)

  return (
    <div className="flex h-screen overflow-hidden bg-stone">
      <AppSidebar menuSections={menuSections} dockItems={dockItems} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader menuSections={menuSections} />
        {/* pb-28 trên mobile để dock nổi không che nội dung cuối trang */}
        {/* flex-col + khung trắng flex-1 (thay min-h-full): có dòng "← Quay lại" phía trên thì khung chỉ lấp phần còn lại, không sinh thanh cuộn thừa */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-stone px-4 pb-28 pt-2 lg:px-6 lg:pb-8 lg:pt-3">
          {/* "← Quay lại" của trang drill-down (usePageBack) — nằm trên nền xám, ngoài khung trắng */}
          {back && (
            <div className="mx-auto mb-2 w-full max-w-[1400px] px-1">
              <Link to={back.to} className="inline-block text-sm font-semibold text-graphite hover:text-charcoal hover:underline">
                ← Quay lại {back.label}
              </Link>
            </div>
          )}
          <div className="mx-auto flex w-full flex-1 max-w-[1400px] flex-col rounded-[24px] border border-warmGray/20 bg-white p-6 shadow-card lg:p-8">
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
