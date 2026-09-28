import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useZoneStore } from '@/stores/zoneStore'
import { useBreadcrumbStore, type Crumb } from '@/stores/breadcrumbStore'
import { useAuth } from '@/hooks/auth/useAuth'
import { usePermission } from '@/hooks/common/usePermission'
import { cn } from '@/lib/cn'
import type { MenuSection } from '@/components/layouts/AppSidebar'
import ZoneSwitcher from '@/components/common/ZoneSwitcher'
import NotificationPopover from '@/components/common/NotificationPopover'
import { IconGlobe, IconLogout } from '@/components/ui/icons'

/** Tên trang + base path theo route hiện tại, tra trong chính menu của role đang đăng nhập. */
function usePageTitle(menuSections: MenuSection[]): { label: string; to: string } {
  const { pathname } = useLocation()
  const items = menuSections.flatMap(s => s.items)
  const match = items.find(i => pathname === i.path || pathname.startsWith(`${i.path}/`))
  return { label: match?.label ?? 'SwiftletCare', to: match?.path ?? pathname }
}

/** Toggle ngôn ngữ hiển thị — UI tĩnh, chưa gắn i18n thật (chưa có hệ thống dịch đa ngôn ngữ trong app). */
function LanguageToggle() {
  const [lang, setLang] = useState<'VI' | 'EN'>('VI')

  return (
    <div className="group/lang relative">
      <div className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-warmGray/20 bg-white px-1.5 shadow-icon">
        <IconGlobe width={16} height={16} className="mr-0.5 shrink-0 text-warmGray" />
        {(['VI', 'EN'] as const).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={cn(
              'rounded-full px-2 py-1 text-xs font-bold transition-colors',
              lang === l ? 'bg-charcoal text-white' : 'text-warmGray hover:bg-warmGray/10',
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Hover preview */}
      <div className="pointer-events-none absolute right-0 z-20 mt-2 w-48 origin-top-right scale-95 rounded-xl border border-warmGray/20 bg-white p-3 opacity-0 shadow-card transition-all duration-150 group-hover/lang:scale-100 group-hover/lang:opacity-100">
        <p className="label-caption">Ngôn ngữ hiển thị</p>
        <p className="mt-1 truncate text-sm font-semibold text-charcoal">{lang === 'VI' ? 'Tiếng Việt' : 'English'}</p>
      </div>
    </div>
  )
}

export default function AppHeader({ menuSections }: { menuSections: MenuSection[] }) {
  const user = useAuthStore(s => s.user)
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const page = usePageTitle(menuSections)
  const selectedZoneName = useZoneStore(s => s.selectedZoneName)
  const registeredTrail = useBreadcrumbStore(s => s.trail)
  // Khớp RequireRole của route /alerts — Sales Staff không có trang này nên không hiện nút
  const canViewAlerts = usePermission('FARM_OWNER', 'TECHNICIAN', 'ADMIN')

  // Trang tự đăng ký breadcrumb (VD Ticket/Farms drill-down) được ưu tiên; không
  // có thì fallback về zone đang chọn (Dashboard/Thiết bị/Phân tích/Cảnh báo).
  const extraCrumbs: Crumb[] = registeredTrail.length > 0
    ? registeredTrail
    : selectedZoneName ? [{ label: selectedZoneName }] : []

  const trail: Crumb[] = [
    { label: page.label, onClick: pathname !== page.to ? () => navigate(page.to) : undefined },
    ...extraCrumbs,
  ]

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-3 bg-transparent px-4 lg:px-6">
      {/* Trái: breadcrumb tên trang → thực thể đang xem (desktop) / thương hiệu (mobile, vì sidebar bị ẩn) */}
      <nav aria-label="breadcrumb" className="flex min-w-0 items-baseline gap-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-charcoal text-sm font-extrabold text-white lg:hidden">
          S
        </span>
        {trail.map((crumb, i) => {
          const isRoot = i === 0
          const isLast = i === trail.length - 1
          const clickable = !!crumb.onClick && !isLast
          const textClass = isRoot
            ? 'truncate text-2xl font-extrabold tracking-tight text-charcoal'
            : isLast
              ? 'truncate text-sm font-medium text-warmGray'
              : 'truncate text-sm font-semibold text-charcoal'
          return (
            <span key={i} className="flex min-w-0 items-baseline gap-1.5">
              {!isRoot && <span aria-hidden="true" className="shrink-0 text-lg font-medium text-warmGray/40">/</span>}
              {clickable ? (
                <button onClick={crumb.onClick} className={cn(textClass, 'transition-opacity hover:opacity-70')}>
                  {crumb.label}
                </button>
              ) : (
                <span className={textClass} aria-current={isLast ? 'page' : undefined}>
                  {crumb.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-3">
        <ZoneSwitcher />
        <LanguageToggle />

        {canViewAlerts && <NotificationPopover />}

        <span
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-charcoal text-sm font-bold text-white lg:flex"
          aria-hidden="true"
        >
          {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
        </span>

        {/* Mobile: sidebar (chứa nút đăng xuất) bị ẩn nên đưa ra đây */}
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label="Đăng xuất"
          title={user?.full_name ? `Đăng xuất ${user.full_name}` : 'Đăng xuất'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
        >
          <IconLogout />
        </button>
      </div>
    </header>
  )
}
