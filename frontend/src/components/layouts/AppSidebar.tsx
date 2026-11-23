import { useEffect, useState, type ComponentType, type SVGProps } from 'react'
import { CaretDownIcon, DotsThreeOutlineIcon } from '@phosphor-icons/react'
import { Link, useLocation } from 'react-router-dom'
import { useCanScrollDown } from '@/hooks/common/useCanScrollDown'
import { cn } from '@/lib/cn'
import { menuLinkState } from '@/lib/navigationState'
import { isMenuItemActive } from '@/lib/menuMatch'
import { useNavigationLabel } from '@/hooks/common/useNavigationLabel'
import { Drawer } from '@/components/ui/Drawer'
import { useMenuBadges } from '@/hooks/common/useMenuBadges'

// Mục menu sáng khi ở bất kỳ trang con nào của nó
export interface MenuTab {
  label: string
  path: string
}

export interface MenuItem {
  label: string
  path: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tabs?: MenuTab[]
}

export interface MenuSection {
  title: string
  items: MenuItem[]
  // Nhóm thu gọn được bằng mũi tên cạnh tiêu đề (mặc định mở); nhóm chứa trang đang mở luôn mở
  collapsible?: boolean
}

// Tiêu đề các nhóm người dùng đã thu gọn, nhớ qua lần mở sau; localStorage có thể bị chặn nên bọc try/catch
const COLLAPSED_KEY = 'swiftletcare-menu-collapsed'

function readCollapsed(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')
    return Array.isArray(stored) ? stored.filter((title): title is string => typeof title === 'string') : []
  } catch {
    return []
  }
}

function writeCollapsed(titles: string[]): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(titles))
  } catch {
    // Không lưu được thì chỉ mất trạng thái thu gọn ở lần mở sau
  }
}

// Sidebar desktop + dock nổi mobile, menu do <Role>Layout truyền vào
export default function AppSidebar({
  menuSections,
  dockItems,
}: {
  menuSections: MenuSection[]
  dockItems: MenuItem[]
}) {
  const badgeByPath = useMenuBadges()
  // Trang hiện tại: ở trang con của 1 mục menu thì link mục đó mang state đi lên
  const { pathname } = useLocation()
  const navigationLabel = useNavigationLabel()
  const { scrollRef, contentRef, canScrollDown } = useCanScrollDown<HTMLElement, HTMLDivElement>()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  // Điện thoại: dock chỉ có 4 mục, mục "Thêm" mở toàn bộ menu để vào các trang còn lại
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const dockPaths = new Set(dockItems.map(item => item.path))
  const moreSections = menuSections
    .map(section => ({ ...section, items: section.items.filter(item => !dockPaths.has(item.path)) }))
    .filter(section => section.items.length > 0)
  const isMoreActive = moreSections.some(section => section.items.some(item => isMenuItemActive(item, pathname)))
  // Đổi trang bằng cách khác (Back của trình duyệt, vuốt Back trên Android) cũng đóng bảng "Thêm"
  useEffect(() => setIsMoreOpen(false), [pathname])

  function toggleSection(title: string): void {
    const next = collapsed.includes(title) ? collapsed.filter(item => item !== title) : [...collapsed, title]
    setCollapsed(next)
    writeCollapsed(next)
  }

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-warmGray/15 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-warmGray/15 px-[18px]">
          <img src="/Logo_SCare_Icon.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" />
          <img src="/Logo_SCare_Text.png" alt="SwiftletCare" className="h-8 w-auto shrink-0" />
        </div>

        <div className="relative min-h-0 flex-1">
          <nav ref={scrollRef} className="h-full overflow-y-auto px-[18px] py-4">
            <div ref={contentRef}>
              {menuSections.map(section => {
                const hasActiveItem = section.items.some(item => isMenuItemActive(item, pathname))
                const isOpen = !section.collapsible || hasActiveItem || !collapsed.includes(section.title)
                const titleClass = 'px-[10px] py-1 text-small font-semibold uppercase tracking-[0.08em] text-warmGray'
                return (
                <div key={section.title} className="mb-4 last:mb-0">
                  {section.collapsible ? (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.title)}
                      disabled={hasActiveItem}
                      aria-expanded={isOpen}
                      className={cn(titleClass, 'flex w-full items-center justify-between rounded-full text-left hover:text-charcoal disabled:cursor-default disabled:hover:text-warmGray')}
                    >
                      {navigationLabel(section.title)}
                      <CaretDownIcon size={14} weight="bold" className={cn('shrink-0 transition-transform', !isOpen && '-rotate-90')} />
                    </button>
                  ) : (
                    <p className={titleClass}>{navigationLabel(section.title)}</p>
                  )}
                  {isOpen && <div className="mt-1 space-y-1">
                    {section.items.map(item => {
                      const badgeCount = badgeByPath[item.path] ?? 0
                      const isActive = isMenuItemActive(item, pathname)
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          state={menuLinkState(item.path, pathname)}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-2 rounded-full px-3 text-sm transition-colors',
                            isActive
                              ? 'h-11 bg-charcoal text-[13px] font-bold text-white shadow-[inset_0_1.5px_0.5px_rgba(255,255,255,0.35)]'
                              : 'h-10 text-[13px] font-medium text-graphite hover:bg-warmGray/10',
                          )}
                        >
                          {isActive ? (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-600 text-charcoal">
                              <item.icon width={16} height={16} />
                            </span>
                          ) : (
                            <item.icon width={16} height={16} className="shrink-0 text-warmGray ml-1" />
                          )}
                          <span className="flex-1 truncate tracking-tight">{navigationLabel(item.label)}</span>
                          {badgeCount > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-alertRed px-1 text-small font-bold text-white">
                              {badgeCount > 9 ? '9+' : badgeCount}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>}
                </div>
                )
              })}
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

      </aside>

      <nav
        aria-label={navigationLabel('Điều hướng chính')}
        className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="flex items-center gap-1 rounded-full border border-warmGray/15 bg-white p-2 shadow-dock">
          {dockItems.map(item => {
            const isActive = isMenuItemActive(item, pathname)
            return (
              <Link
                key={item.path}
                to={item.path}
                state={menuLinkState(item.path, pathname)}
                aria-label={navigationLabel(item.label)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-12 items-center gap-2 rounded-full px-3.5 transition-colors',
                  isActive ? 'bg-charcoal text-white' : 'text-warmGray hover:bg-warmGray/10',
                )}
              >
                <item.icon width={20} height={20} className="shrink-0" />
                {/* Dock 5 nút (có "Thêm") không đủ chỗ cho nhãn ở màn 375px: chỉ nền tối, tên trang đã ở header */}
                {isActive && moreSections.length === 0 && <span className="text-sm font-semibold">{navigationLabel(item.label)}</span>}
              </Link>
            )
          })}
          {moreSections.length > 0 && (
            <button
              type="button"
              onClick={() => setIsMoreOpen(open => !open)}
              aria-expanded={isMoreOpen}
              aria-label={navigationLabel('Thêm')}
              className={cn(
                'relative flex h-12 items-center gap-2 rounded-full px-3.5 transition-colors',
                isMoreActive || isMoreOpen ? 'bg-charcoal text-white' : 'text-warmGray hover:bg-warmGray/10',
              )}
            >
              <DotsThreeOutlineIcon size={20} className="shrink-0" />
              {moreSections.some(section => section.items.some(item => (badgeByPath[item.path] ?? 0) > 0)) && (
                <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-alertRed" />
              )}
            </button>
          )}
        </div>
      </nav>

      {/* Bảng "Thêm" trên điện thoại: các mục không nằm trên dock, theo nhóm, kèm badge */}
      <Drawer side="bottom" open={isMoreOpen} onClose={() => setIsMoreOpen(false)} title={navigationLabel('Thêm')}>
        <nav aria-label={navigationLabel('Thêm')}>
          {moreSections.map(section => (
            <div key={section.title} className="mb-2 last:mb-0">
              <p className="px-3 py-1 text-small font-semibold uppercase tracking-[0.08em] text-warmGray">{navigationLabel(section.title)}</p>
              {section.items.map(item => {
                const badgeCount = badgeByPath[item.path] ?? 0
                const isActive = isMenuItemActive(item, pathname)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    state={menuLinkState(item.path, pathname)}
                    onClick={() => setIsMoreOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn('flex min-h-11 items-center gap-3 rounded-2xl px-3 text-body font-medium', isActive ? 'bg-charcoal text-white' : 'text-charcoal hover:bg-warmGray/10')}
                  >
                    <item.icon width={18} height={18} className="shrink-0" />
                    <span className="flex-1">{navigationLabel(item.label)}</span>
                    {badgeCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-alertRed px-1 text-small font-bold text-white">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </Drawer>
    </>
  )
}
