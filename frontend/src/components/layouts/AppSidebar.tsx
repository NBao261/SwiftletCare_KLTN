import type { ComponentType, SVGProps } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAlertStore } from '@/stores/alertStore'
import { useAuth } from '@/hooks/auth/useAuth'
import { cn } from '@/lib/cn'
import { IconLogout } from '@/components/ui/icons'
import { ROLE_LABEL } from '@/constants/roles'

export interface MenuItem {
  label: string
  /** Path tuyệt đối, khớp `path` khai trong routes/<role>.routes.tsx */
  path: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export interface MenuSection {
  title: string
  items: MenuItem[]
}

/** Số mục tối đa trên dock mobile — 4 nút tròn + 1 nhãn mục đang mở vừa khít 375px (UX-NFR-001). */
const DOCK_SIZE = 4

/** Dock mặc định: DOCK_SIZE mục đầu sidebar (tần suất dùng hằng ngày cao nhất). */
export function firstDockItems(sections: MenuSection[]): MenuItem[] {
  return sections.flatMap(s => s.items).slice(0, DOCK_SIZE)
}

/**
 * Điều hướng chính, thuần trình bày — menu do `<Role>Layout.tsx` truyền vào.
 * Gồm cả 2 dạng vì chúng là cùng một menu ở 2 breakpoint: sidebar `w-64` cho
 * desktop và dock nổi cho mobile (sidebar cố định chiếm gần hết màn 375px nên
 * không dùng được ở đó — UX-NFR-001 yêu cầu hỗ trợ ≥375px).
 */
export default function AppSidebar({
  menuSections,
  dockItems,
}: {
  menuSections: MenuSection[]
  dockItems: MenuItem[]
}) {
  const user = useAuthStore(s => s.user)
  const unreadCount = useAlertStore(s => s.unreadCount)
  const { logout } = useAuth()

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-warmGray/15 bg-white lg:flex">
        {/* Logo row — h-16 khớp đúng chiều cao AppHeader (h-16) để tạo 1 đường ngang liền mạch giữa Sidebar/AppHeader */}
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
          {menuSections.map(section => (
            <div key={section.title} className="mb-4">
              <p className="label-caption px-[10px] py-1">{section.title}</p>
              <div className="space-y-1">
                {section.items.map(item => {
                  const badgeCount = item.path === '/alerts' ? unreadCount : 0
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
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

      {/* Dock nổi cho mobile/tablet — khung `rounded-full` nền trắng, shadow dock (FE_Design_Claude.md §2) */}
      <nav
        aria-label="Điều hướng chính"
        className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="flex items-center gap-1 rounded-full border border-warmGray/15 bg-white p-2 shadow-dock">
          {dockItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
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
                  {/* Chỉ mục đang mở mới hiện nhãn — dock gọn, vẫn biết mình đang ở đâu */}
                  {isActive && <span className="text-sm font-semibold">{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
