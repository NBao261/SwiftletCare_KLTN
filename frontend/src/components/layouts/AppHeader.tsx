import { useLocation, useNavigate } from 'react-router-dom'
import { useBreadcrumbStore, type Crumb } from '@/stores/breadcrumbStore'
import { useHeaderSlotStore } from '@/stores/headerSlotStore'
import { cn } from '@/lib/cn'
import { useNavigationLabel } from '@/hooks/common/useNavigationLabel'
import type { MenuItem, MenuSection } from '@/components/layouts/AppSidebar'
import { activeTabPath, isMenuItemActive } from '@/lib/menuMatch'
import NotificationPopover from '@/components/common/NotificationPopover'
import ProfilePopover from '@/components/common/ProfilePopover'
import LanguageToggle from '@/components/common/LanguageToggle'

// Trang không nằm trên sidebar mà mở từ menu avatar (SH-03): Cài đặt và Quyền riêng tư
const AVATAR_MENU_PAGES: Pick<MenuItem, 'label' | 'path' | 'tabs'>[] = [{ label: 'Cài đặt', path: '/settings' }]

/** Tên trang + base path theo route hiện tại, tra trong chính menu của role đang đăng nhập. */
function usePageTitle(menuSections: MenuSection[]): { label: string; to: string } {
  const { pathname } = useLocation()
  const navigationLabel = useNavigationLabel()
  const items = [...menuSections.flatMap(section => section.items), ...AVATAR_MENU_PAGES]
  const match = items.find(item => isMenuItemActive(item, pathname))
  // Ở một tab: tên trang là tên mục menu, gốc breadcrumb là tab đang mở (không bấm được)
  const tabPath = activeTabPath(match?.tabs ?? [], pathname)
  return { label: match ? navigationLabel(match.label) : 'SwiftletCare', to: tabPath ?? match?.path ?? pathname }
}

/** `elevated` = nội dung đang cuộn bên dưới header → hiện viền mờ để tách header khỏi nội dung */
export default function AppHeader({ menuSections, elevated = false }: { menuSections: MenuSection[]; elevated?: boolean }) {
  const setHeaderSlot = useHeaderSlotStore(state => state.setSlot)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const page = usePageTitle(menuSections)
  const registeredTrail = useBreadcrumbStore(s => s.trail)
  const rootState = useBreadcrumbStore(s => s.rootState)

  // Chỉ trang tự đăng ký breadcrumb (VD Farms drill-down) mới có cấp con
  const trail: Crumb[] = [
    { label: page.label, onClick: pathname !== page.to ? () => navigate(page.to, { state: rootState }) : undefined },
    ...registeredTrail,
  ]

  return (
    // Kính vẽ ở lớp nền -z-10 để kính của popup con không bị cắt; flex-wrap cho thanh phạm vi dưới xl (SH-07)
    <header className="relative isolate flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3 lg:px-8">
      {/* Kính trong (glassmorphism): chỉ phủ 10% trắng + blur; khi cuộn thêm viền sáng */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 -z-10 border-b bg-white/10 backdrop-blur-lg backdrop-saturate-150 transition-[border-color,box-shadow] duration-300',
          elevated ? 'border-white/60 shadow-glass' : 'border-transparent',
        )}
      />

      {/* Trái: tên trang (h1, C-01) → thực thể đang xem; điện thoại xuống tối đa 2 dòng thay vì cắt (SH-05) */}
      <nav aria-label="breadcrumb" className="order-1 flex min-w-0 flex-1 items-baseline gap-1.5">
        {trail.map((crumb, i) => {
          const isRoot = i === 0
          const isLast = i === trail.length - 1
          const clickable = !!crumb.onClick && !isLast
          const textClass = isRoot
            ? 'text-xl font-extrabold tracking-tight text-charcoal max-sm:line-clamp-2 sm:truncate sm:text-2xl'
            : isLast
              ? 'truncate text-sm font-medium text-warmGray'
              : 'truncate text-sm font-semibold text-charcoal'
          const CrumbTag = isRoot ? 'h1' : 'span'
          return (
            <CrumbTag key={i} className="flex min-w-0 items-baseline gap-1.5">
              {!isRoot && <span aria-hidden="true" className="shrink-0 text-lg font-medium text-warmGray/40">/</span>}
              {clickable ? (
                <button onClick={crumb.onClick} className={cn(textClass, 'text-left transition-opacity hover:opacity-70')}>
                  {crumb.label}
                </button>
              ) : (
                <span className={textClass} aria-current={isLast ? 'page' : undefined}>
                  {crumb.label}
                </span>
              )}
            </CrumbTag>
          )
        })}
      </nav>

      {/* Chỗ trang đặt thanh phạm vi (HeaderActions): từ xl cùng hàng tên trang, dưới xl hàng riêng ngay dưới (SH-07); trống thì ẩn */}
      <div ref={setHeaderSlot} className="order-3 flex basis-full empty:hidden xl:order-2 xl:basis-auto" />

      {/* Phải: VI/EN · chuông · avatar (menu avatar là nơi duy nhất có Cài đặt, Quyền riêng tư, Đăng xuất ở mọi khổ màn, SH-02) */}
      <div className="order-2 flex shrink-0 items-center gap-3 xl:order-3">
        <div className="max-sm:hidden">
          <LanguageToggle />
        </div>
        {/* Mọi role có hộp thông báo (EXPERT-FR-007); tab Cảnh báo chỉ cho role vào được /alerts */}
        <NotificationPopover />
        <ProfilePopover />
      </div>
    </header>
  )
}
