import { Suspense } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
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
        <main className="flex-1 overflow-y-auto bg-stone pb-28 pt-4 lg:pb-8 lg:pt-6">
          {/* Container duy nhất bọc mọi card nội dung — max-w + mx-auto để nội
              dung luôn căn giữa vùng nhìn ở màn hình rộng (Full HD/2K/4K), px-6/
              px-8 là lề 2 bên đồng nhất khi viewport hẹp hơn max-width. */}
          <div className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col px-6 lg:px-8">
            {/* Nút quay lại của trang drill-down (usePageBack) — nút tròn cùng kiểu Dashboard Farm Owner (FarmOwnerDashboardPage)
                + chữ tên trang cha; cả cụm là 1 link. self-start để vùng bấm không kéo hết hàng */}
            {back && (
              <Link to={back.to} className="group mb-3 flex items-center gap-2.5 self-start text-sm font-semibold text-graphite hover:text-charcoal">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-warmGray/15 bg-white text-charcoal shadow-icon transition-colors group-hover:bg-warmGray/10">
                  <ArrowLeft width={18} height={18} />
                </span>
                Quay lại {back.label}
              </Link>
            )}
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
