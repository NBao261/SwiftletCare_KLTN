import { Suspense, useRef, useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useBreadcrumbStore } from '@/stores/breadcrumbStore'
import AppSidebar, { type MenuItem, type MenuSection } from '@/components/layouts/AppSidebar'
import AppHeader from '@/components/layouts/AppHeader'
import Toast from '@/components/common/Toast'
import LogoutConfirmModal from '@/components/common/LogoutConfirmModal'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useAlertNotifications } from '@/hooks/shared/useAlertNotifications'
import { useTranslation as useI18next } from 'react-i18next'
import { t } from '@/i18n'

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
  // Đổi VI/EN → AppShell render lại (sidebar/header theo), vùng nội dung remount (key) để mọi t() gọi trong hàm thường
  // (cột bảng, helper ngày, bảng nhãn) ra đúng ngôn ngữ mới. Mất state tạm của trang (bộ lọc đang chọn) — chấp nhận được
  const { i18n } = useI18next()
  const [scrolled, setScrolled] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  return (
    <div className="flex h-screen overflow-hidden bg-stone">
      <AppSidebar menuSections={menuSections} dockItems={dockItems} />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header nổi đè lên vùng cuộn và phủ hết bề ngang cột (cả phần thanh cuộn) — nội dung trượt bên dưới
            bị blur. Không nằm trong <main> nên lăn chuột trên header phải chuyển tiếp sang <main> */}
        <div onWheel={e => mainRef.current?.scrollBy({ top: e.deltaY })} className="absolute inset-x-0 top-0 z-20">
          <AppHeader menuSections={menuSections} elevated={scrolled} />
        </div>
        {/* pt-16 chừa đúng chiều cao header; pb-28 trên mobile để dock nổi không che nội dung cuối trang */}
        <main
          ref={mainRef}
          onScroll={e => setScrolled(e.currentTarget.scrollTop > 0)}
          className="flex flex-1 flex-col overflow-y-auto bg-stone pb-28 pt-16 lg:pb-8"
        >
          {/* Container duy nhất bọc mọi card nội dung — max-w + mx-auto để nội
              dung luôn căn giữa vùng nhìn ở màn hình rộng (Full HD/2K/4K), px-6/
              px-8 là lề 2 bên đồng nhất khi viewport hẹp hơn max-width. */}
          <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 pt-4 lg:px-8 lg:pt-6">
            {/* Nút quay lại của trang drill-down (usePageBack) — nút tròn cùng kiểu Dashboard Farm Owner (FarmOwnerDashboardPage)
                + chữ tên trang cha; cả cụm là 1 link. self-start để vùng bấm không kéo hết hàng */}
            {back && (
              <Link to={back.to} className="group mb-3 flex items-center gap-2.5 self-start text-sm font-semibold text-graphite hover:text-charcoal">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-warmGray/15 bg-white text-charcoal shadow-icon transition-colors group-hover:bg-warmGray/10">
                  <ArrowLeft width={18} height={18} />
                </span>
                {t('Quay lại {{page}}', { page: t(back.label) })}
              </Link>
            )}
            {/* Suspense đặt SÁT Outlet (không bọc ở App.tsx cấp cao hơn) — chunk
                lazy-load lần đầu chỉ thay skeleton trong khung nội dung này,
                sidebar/header/dock không bị unmount nên không còn nháy toàn
                màn hình khi chuyển tab lần đầu. */}
            <Suspense key={i18n.language} fallback={<LoadingSkeleton className="h-40 w-full" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <Toast />
      <LogoutConfirmModal />
    </div>
  )
}
