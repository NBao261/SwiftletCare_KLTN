import { useState, useRef, useEffect, type ComponentType, type SVGProps } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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

/** Component Tooltip cục bộ cho Sidebar dùng Portal để không bị cắt bởi overflow-auto */
function SidebarTooltip({ text, disabled, position = 'right', children }: { text: string, disabled: boolean, position?: 'right' | 'top', children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const anchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hovered && anchorRef.current && !disabled) {
      const rect = anchorRef.current.getBoundingClientRect()
      if (position === 'right') {
        setCoords({ top: rect.top + rect.height / 2, left: rect.right + 8 })
      } else {
        setCoords({ top: rect.top - 8, left: rect.left + rect.width / 2 })
      }
    }
  }, [hovered, disabled, position])

  return (
    <>
      <div 
        ref={anchorRef} 
        onMouseEnter={() => setHovered(true)} 
        onMouseLeave={() => setHovered(false)}
        className="flex w-full justify-center"
      >
        {children}
      </div>
      
      {!disabled && hovered && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none transition-opacity animate-in fade-in duration-200"
          style={{ 
            top: coords.top, 
            left: coords.left, 
            transform: position === 'right' ? 'translateY(-50%)' : 'translate(-50%, -100%)' 
          }}
        >
          <div className="relative rounded-md bg-charcoal px-2.5 py-1.5 text-[12px] font-medium text-white shadow-md whitespace-nowrap">
            {text}
            {position === 'right' ? (
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-charcoal border-l-0" />
            ) : (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-charcoal border-b-0" />
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
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

  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')
  const toggleCollapse = () => setIsCollapsed(prev => {
    const newVal = !prev
    localStorage.setItem('sidebar_collapsed', String(newVal))
    return newVal
  })

  return (
    <>
      <aside className={cn(
        "hidden shrink-0 flex-col border-r border-warmGray/15 bg-white lg:flex transition-[width] duration-300 relative",
        isCollapsed ? 'w-[84px]' : 'w-64'
      )}>
        {/* Logo row */}
        <div className={cn(
          "flex h-16 shrink-0 items-center border-b border-warmGray/15 transition-all duration-300",
          isCollapsed ? 'justify-center px-0' : 'px-[18px]'
        )}>
          <img src="/Logo_SCare_Icon.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" />
          {!isCollapsed && <img src="/Logo_SCare_Text.png" alt="SwiftletCare" className="ml-2.5 h-8 w-auto shrink-0" />}
        </div>

        <div className="relative">
          {/* Greeting */}
          <div className={cn(
            "transition-all duration-300 overflow-hidden",
            isCollapsed ? 'h-0 opacity-0 mt-0' : 'px-[18px] mt-6 opacity-100 h-[68px]'
          )}>
            <p className="text-[13px] text-warmGray">Xin chào,</p>
            <p className="truncate text-xl font-bold text-charcoal">{user?.full_name}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-warmGray">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              Role: {user?.role ? ROLE_LABEL[user.role] : ''}
            </p>
          </div>
        </div>

        {/* Divider — tách Greeting khỏi Navigation Menu */}
        <div className={cn(
          "border-t border-warmGray/15 transition-all duration-300",
          isCollapsed ? 'mt-4 mx-4' : 'mt-6 mx-[18px]'
        )} />

        <nav className="flex-1 overflow-y-auto px-[14px] pb-3 pt-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {menuSections.map(section => (
            <div key={section.title} className={cn("mb-4", isCollapsed && "mb-2")}>
              {!isCollapsed && (
                <p className="px-[14px] py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-warmGray">
                  {section.title}
                </p>
              )}
              <div className={cn("space-y-1", isCollapsed && "flex flex-col items-center gap-2 space-y-0")}>
                {section.items.map(item => {
                  const badgeCount = item.path === '/alerts' ? unreadCount : 0
                  return (
                    <SidebarTooltip key={item.path} text={item.label} disabled={!isCollapsed}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          cn(
                            'flex w-full items-center rounded-full transition-colors relative',
                            isCollapsed ? 'justify-center w-12 h-12 mx-auto' : 'gap-2.5 px-[14px] h-11',
                            isActive
                              ? 'bg-charcoal text-[13.5px] font-bold text-white shadow-[inset_0_1.5px_0.5px_rgba(255,255,255,0.35)]'
                              : 'font-medium text-graphite hover:bg-warmGray/10',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive ? (
                              isCollapsed ? (
                                <item.icon width={22} height={22} className="shrink-0 text-limeMist" />
                              ) : (
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-limeMist text-charcoal">
                                  <item.icon width={16} height={16} />
                                </span>
                              )
                            ) : (
                              <item.icon width={isCollapsed ? 22 : 16} height={isCollapsed ? 22 : 16} className={cn("shrink-0", !isCollapsed && "text-warmGray")} />
                            )}
                            {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                            {badgeCount > 0 && (
                              <span className={cn(
                                "flex items-center justify-center rounded-full bg-alertRed font-bold text-white",
                                isCollapsed ? "absolute top-2.5 right-2.5 h-2.5 w-2.5 p-0 text-[0px]" : "h-5 min-w-5 shrink-0 px-1 text-[11px]"
                              )}>
                                {!isCollapsed && (badgeCount > 9 ? '9+' : badgeCount)}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarTooltip>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 flex flex-col gap-2 px-[14px] pb-6 pt-2">
          {/* Nút Expand (Chỉ hiện khi thu gọn, nằm trên nút Đăng xuất) */}
          {isCollapsed && (
            <SidebarTooltip text="Mở rộng thanh bên" disabled={!isCollapsed}>
              <button
                onClick={toggleCollapse}
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-warmGray transition-all hover:bg-warmGray/10 hover:text-charcoal"
              >
                <PanelLeftOpen width={24} height={24} />
              </button>
            </SidebarTooltip>
          )}

          <div className={cn("flex w-full items-center gap-2", isCollapsed && "justify-center")}>
            <div className={cn("flex", isCollapsed ? "w-12 mx-auto" : "flex-1 w-full")}>
              <SidebarTooltip text="Đăng xuất" disabled={!isCollapsed}>
                <button
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  className={cn(
                    "flex items-center justify-center gap-2 w-full rounded-full border border-warmGray/15 font-medium text-graphite transition-all hover:bg-alertRed/10 hover:text-alertRed hover:border-alertRed/30 disabled:cursor-not-allowed disabled:opacity-50",
                    isCollapsed ? "h-12 w-12 px-0" : "h-[42px] px-4 text-[12.5px]"
                  )}
                >
                  <IconLogout width={isCollapsed ? 22 : 18} height={isCollapsed ? 22 : 18} className="shrink-0" />
                  {!isCollapsed && <span className="truncate">Đăng xuất</span>}
                </button>
              </SidebarTooltip>
            </div>
            
            {/* Nút Collapse (Chỉ hiện khi mở rộng, nằm cạnh nút Đăng xuất) */}
            {!isCollapsed && (
              <div className="shrink-0">
                <SidebarTooltip text="Thu gọn thanh bên" disabled={isCollapsed} position="top">
                  <button
                    onClick={toggleCollapse}
                    className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-warmGray/15 text-warmGray transition-all hover:bg-warmGray/10 hover:text-charcoal"
                  >
                    <PanelLeftClose width={20} height={20} />
                  </button>
                </SidebarTooltip>
              </div>
            )}
          </div>
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
