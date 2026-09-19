import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAlertStore } from '@/store/alertStore'
import { useZoneStore } from '@/store/zoneStore'
import { useBreadcrumbStore, type Crumb } from '@/store/breadcrumbStore'
import { useAuth } from '@/hooks/useAuth'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/utils/cn'
import { getNavSections, ALL_NAV_ITEMS } from '@/constants/navigation'
import ZoneSwitcher from './ZoneSwitcher'
import NotificationPopover from './NotificationPopover'
import { IconGlobe, IconLogout } from '@/components/ui/icons'
import { ROLE_LABEL } from '@/constants/roles'

/**
 * Sidebar + TopBar — 1 file dùng chung cho mọi role (chỉ khác nav item lọc theo
 * role qua `getNavSections`, xem constants/navigation.ts). Gộp về `components/common` vì
 * đây là UI khung ứng dụng dùng lại cho Admin/FarmOwner/Technician/SalesStaff,
 * không phải riêng 1 nhóm role như thư mục `pages/<Role>`.
 */

/** Sidebar desktop — nền trắng, viền phải mờ. Ẩn dưới breakpoint lg, khi đó điều hướng chuyển sang MobileDock. */
export function Sidebar() {
  const user = useAuthStore(s => s.user)
  const unreadCount = useAlertStore(s => s.unreadCount)
  const { logout } = useAuth()
  const sections = getNavSections(user?.role)

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-warmGray/15 bg-white lg:flex">
      {/* Logo row — h-16 khớp đúng chiều cao TopBar (h-16) để tạo 1 đường ngang liền mạch giữa Sidebar/TopBar */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-warmGray/15 px-[18px]">
        <img src="/Logo_SCare_Icon.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" />
        <img src="/Logo_SCare_Text.png" alt="SwiftletCare" className="h-8 w-auto shrink-0" />
      </div>

      <div className="px-[18px]">
        <div className="mt-6">
          <p className="text-[13px] text-warmGray">Xin chào,</p>
          <p className="truncate text-xl font-bold text-charcoal">{user?.full_name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-warmGray">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
            Role: {user?.role ? ROLE_LABEL[user.role] : ''}
          </p>
        </div>

        {/* Divider — tách Greeting khỏi Navigation Menu */}
        <div className="mt-6 border-t border-warmGray/15" />
      </div>

      <nav className="flex-1 overflow-y-auto px-[18px] pb-3 pt-[18px]">
        {sections.map(section => (
          <div key={section.title} className="mb-4">
            <p className="label-caption px-[10px] py-1">{section.title}</p>
            <div className="space-y-1">
              {section.items.map(item => {
                const badgeCount = item.to === '/alerts' ? unreadCount : 0
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-full px-[14px] text-sm transition-colors',
                        isActive
                          ? 'h-11 bg-charcoal text-[13.5px] font-bold text-white shadow-[inset_0_1.5px_0.5px_rgba(255,255,255,0.35)]'
                          : 'h-10 font-medium text-graphite hover:bg-warmGray/10',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-limeMist text-charcoal">
                            <item.icon width={16} height={16} />
                          </span>
                        ) : (
                          <item.icon width={16} height={16} className="shrink-0 text-warmGray" />
                        )}
                        <span className="flex-1 truncate">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-alertRed px-1 text-[11px] font-bold text-white">
                            {badgeCount > 9 ? '9+' : badgeCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-[18px] pb-6">
        <button
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex h-[42px] w-full items-center justify-center gap-2 rounded-full border border-warmGray/15 px-4 text-[12.5px] font-medium text-graphite transition-colors hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconLogout width={15} height={15} />
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}

/** Tên trang + base path (`to`) theo route hiện tại — không lọc theo role vì tên trang không đổi tuỳ người xem */
function usePageTitle(): { label: string; to: string } {
  const { pathname } = useLocation()
  const match = ALL_NAV_ITEMS.find(i => pathname === i.to || pathname.startsWith(`${i.to}/`))
  return { label: match?.label ?? 'SwiftletCare', to: match?.to ?? pathname }
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

export function TopBar() {
  const user = useAuthStore(s => s.user)
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const page = usePageTitle()
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
