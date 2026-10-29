import type { ComponentType, SVGProps } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAlertStore } from '@/stores/alertStore'
import { useAuth } from '@/hooks/auth/useAuth'
import { useCanScrollDown } from '@/hooks/common/useCanScrollDown'
import { cn } from '@/lib/cn'
import { menuLinkState } from '@/lib/navigationState'
import { IconLogout } from '@/components/ui/icons'
import { ROLE_LABEL } from '@/constants/roles'
import { useNavigationLabel } from '@/hooks/common/useNavigationLabel'
import { useExpertPendingAlerts } from '@/hooks/domain-expert/useExpertDashboard'

export interface MenuItem {
  label: string
  path: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export interface MenuSection {
  title: string
  items: MenuItem[]
}

const DOCK_SIZE = 4

// Dock mobile mặc định: 4 mục đầu sidebar
export function firstDockItems(sections: MenuSection[]): MenuItem[] {
  return sections.flatMap(s => s.items).slice(0, DOCK_SIZE)
}

// Sidebar desktop + dock nổi mobile, menu do <Role>Layout truyền vào
export default function AppSidebar({
  menuSections,
  dockItems,
}: {
  menuSections: MenuSection[]
  dockItems: MenuItem[]
}) {
  const user = useAuthStore(s => s.user)
  const unreadCount = useAlertStore(s => s.unreadCount)
  const isExpert = user?.role === 'DOMAIN_EXPERT'
  const { data: expertAlerts } = useExpertPendingAlerts(undefined, undefined, isExpert)
  const expertPendingCount = isExpert ? (expertAlerts?.length ?? 0) : 0
  const { logout } = useAuth()
  // Trang hiện tại: ở trang con của 1 mục menu thì link mục đó mang state đi lên
  const { pathname } = useLocation()
  const navigationLabel = useNavigationLabel()
  const { scrollRef, contentRef, canScrollDown } = useCanScrollDown<HTMLElement, HTMLDivElement>()

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-warmGray/15 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-warmGray/15 px-[18px]">
          <img src="/Logo_SCare_Icon.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" />
          <img src="/Logo_SCare_Text.png" alt="SwiftletCare" className="h-8 w-auto shrink-0" />
        </div>

        <div className="px-[18px]">
          <div className="mt-6">
            <p className="text-[13px] text-warmGray">{navigationLabel('Xin chào,')}</p>
            <p className="truncate text-xl font-bold text-charcoal">{user?.full_name}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-warmGray">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              Role: {user?.role ? navigationLabel(ROLE_LABEL[user.role]) : ''}
            </p>
          </div>

          <div className="mt-6 border-t border-warmGray/15" />
        </div>

        <div className="relative min-h-0 flex-1">
          <nav ref={scrollRef} className="h-full overflow-y-auto px-[18px] py-[5px]">
            <div ref={contentRef}>
              {menuSections.map(section => (
                <div key={section.title} className="mb-4 last:mb-0">
                  <p className="px-[10px] py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-warmGray">{navigationLabel(section.title)}</p>
                  <div className="space-y-1">
                    {section.items.map(item => {
                      const badgeCount = (item.path === '/domain-expert/alert-verdicts' || item.path === '/expert/audit-logs')
                        ? (isExpert ? expertPendingCount : unreadCount)
                        : item.path === '/alerts'
                          ? unreadCount
                          : 0
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          state={menuLinkState(item.path, pathname)}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2 rounded-full px-3 text-sm transition-colors',
                              isActive
                                ? 'h-11 bg-charcoal text-[13px] font-bold text-white shadow-[inset_0_1.5px_0.5px_rgba(255,255,255,0.35)]'
                                : 'h-10 text-[13px] font-medium text-graphite hover:bg-warmGray/10',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {isActive ? (
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-600 text-charcoal">
                                  <item.icon width={16} height={16} />
                                </span>
                              ) : (
                                <item.icon width={16} height={16} className="shrink-0 text-warmGray ml-1" />
                              )}
                              <span className="flex-1 truncate tracking-tight">{navigationLabel(item.label)}</span>
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
            </div>
          </nav>
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-charcoal/20 to-transparent transition-opacity duration-200',
              canScrollDown ? 'opacity-100' : 'opacity-0',
            )}
          />
        </div>

        <div className="mx-[18px] border-t border-warmGray/15 pb-6 pt-3">
          <button
            onClick={() => logout.mutate()}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-safetyOrange transition-colors hover:bg-safetyOrange/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconLogout width={16} height={16} />
            {navigationLabel('Đăng xuất')}
          </button>
        </div>
      </aside>

      <nav
        aria-label={navigationLabel('Điều hướng chính')}
        className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="flex items-center gap-1 rounded-full border border-warmGray/15 bg-white p-2 shadow-dock">
          {dockItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              state={menuLinkState(item.path, pathname)}
              aria-label={navigationLabel(item.label)}
              className={({ isActive }) =>
                cn(
                  'flex h-12 items-center gap-2 rounded-full px-3.5 transition-colors',
                  isActive ? 'bg-charcoal text-white' : 'text-warmGray hover:bg-warmGray/10',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon width={20} height={20} className="shrink-0" />
                  {isActive && <span className="text-sm font-semibold">{navigationLabel(item.label)}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
