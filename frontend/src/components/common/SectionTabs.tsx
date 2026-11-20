import { Link, useLocation } from 'react-router-dom'
import type { MenuSection } from '@/components/layouts/AppSidebar'
import { activeTabPath, isMenuItemActive } from '@/lib/menuMatch'
import { canAccessPath } from '@/constants/roles'
import { useNavigationLabel } from '@/hooks/common/useNavigationLabel'
import { cn } from '@/lib/cn'
import { menuLinkState } from '@/lib/navigationState'
import { useAuthStore } from '@/stores/authStore'

// Tab trên đầu trang cho mục menu gộp nhiều trang (MenuItem.tabs): mỗi tab là một route, kiểu pill như trang Sức khỏe nhà yến
export default function SectionTabs({ menuSections }: { menuSections: MenuSection[] }) {
  const { pathname } = useLocation()
  const role = useAuthStore(state => state.user?.role)
  const navigationLabel = useNavigationLabel()
  const item = menuSections.flatMap(section => section.items).find(entry => entry.tabs && isMenuItemActive(entry, pathname))
  const tabs = (item?.tabs ?? []).filter(tab => canAccessPath(role, tab.path))
  if (tabs.length < 2) return null
  const activePath = activeTabPath(tabs, pathname)

  return (
    <nav aria-label={item ? navigationLabel(item.label) : undefined} className="mb-5 inline-flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-warmGray/10 p-1 max-sm:flex-wrap max-sm:rounded-3xl">
      {tabs.map(tab => {
        const isActive = tab.path === activePath
        return (
          <Link
            key={tab.path}
            to={tab.path}
            state={menuLinkState(tab.path, pathname)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex h-9 items-center whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150 max-sm:px-3',
              isActive ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
            )}
          >
            {navigationLabel(tab.label)}
          </Link>
        )
      })}
    </nav>
  )
}
