import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useBreadcrumbStore } from '@/stores/breadcrumbStore'
import AppSidebar, { type MenuItem, type MenuSection } from '@/components/layouts/AppSidebar'
import AppHeader from '@/components/layouts/AppHeader'
import Toast from '@/components/common/Toast'
import SectionTabs from '@/components/common/SectionTabs'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useAlertNotifications } from '@/hooks/shared/useAlertNotifications'
import { useInAppNotificationListener } from '@/hooks/shared/useNotifications'
import { useTranslation as useI18next } from 'react-i18next'
import { t } from '@/i18n'

// Khung chung của cả 4 role, chỉ khác menu do <Role>Layout truyền xuống
export default function AppShell({
  menuSections,
  dockItems,
}: {
  menuSections: MenuSection[]
  dockItems: MenuItem[]
}) {
  useAlertNotifications()
  // thông báo trong ứng dụng mới: làm mới hộp thư và hiện toast ở mọi trang
  useInAppNotificationListener()
  const back = useBreadcrumbStore(s => s.back)
  // Đổi ngôn ngữ thì remount nội dung để t() trong hàm thường ra đúng ngôn ngữ
  const { i18n } = useI18next()
  const [scrolled, setScrolled] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  // Header 1 hoặc 2 hàng: đo để nội dung chừa đúng chừng đó
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(64)
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    const observer = new ResizeObserver(() => setHeaderHeight(header.offsetHeight))
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-stone">
      <AppSidebar menuSections={menuSections} dockItems={dockItems} />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header không nằm trong <main> nên lăn chuột trên header phải chuyển sang <main> */}
        <div ref={headerRef} onWheel={e => mainRef.current?.scrollBy({ top: e.deltaY })} className="absolute inset-x-0 top-0 z-20">
          <AppHeader menuSections={menuSections} elevated={scrolled} />
        </div>
        {/* paddingTop chừa đúng chiều cao header; pb-28 trên mobile để dock nổi không che nội dung cuối trang */}
        <main
          ref={mainRef}
          onScroll={e => setScrolled(e.currentTarget.scrollTop > 0)}
          style={{ paddingTop: headerHeight }}
          className="relative z-10 flex flex-1 flex-col overflow-y-auto bg-stone pb-28 lg:pb-8"
        >
          {/* Container căn giữa ở màn hình rộng */}
          <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-6 pt-4 lg:px-8 lg:pt-6">
            {/* Nút quay lại của trang drill-down */}
            {back && (
              <Link to={back.to} state={back.state} className="group mb-3 flex items-center gap-2.5 self-start text-sm font-semibold text-graphite hover:text-charcoal">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-warmGray/15 bg-white text-charcoal shadow-icon transition-colors group-hover:bg-warmGray/10">
                  <ArrowLeft width={18} height={18} />
                </span>
                {t('Quay lại {{page}}', { page: t(back.label) })}
              </Link>
            )}
            {/* Mục menu gộp nhiều trang: tab của các trang con, ngay trên nội dung */}
            <SectionTabs menuSections={menuSections} />
            {/* Suspense sát Outlet để lần tải chunk đầu không làm sidebar/header nháy */}
            <Suspense key={i18n.language} fallback={<LoadingSkeleton className="h-40 w-full" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <Toast />
    </div>
  )
}
