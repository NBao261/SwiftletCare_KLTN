import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'
import { getNavSections } from './navItems'
import { IconLogout } from '@/components/ui/icons'
import { ROLE_LABEL } from '@/constants/roles'

/**
 * Sidebar desktop — FE_Design_Swiftlet.md §3.C (nền Charcoal, accent Lime Mist).
 * Ẩn dưới breakpoint lg, khi đó điều hướng chuyển sang MobileDock (§3.A).
 */
export default function Sidebar() {
  const user = useAuthStore(s => s.user)
  const { logout } = useAuth()
  const sections = getNavSections(user?.role)

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-charcoal lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-limeMist text-sm font-extrabold text-charcoal">
          S
        </span>
        <span className="text-base font-bold tracking-tight text-white">SwiftletCare</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {sections.map(section => (
          <div key={section.title} className="mb-4">
            <p className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors',
                      isActive
                        ? 'bg-limeMist font-bold text-charcoal'
                        : 'font-medium text-white/70 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  <item.icon width={18} height={18} className="shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Khối người dùng ở chân sidebar — giải phóng thanh trên cho ngữ cảnh Zone */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-limeMist text-sm font-bold text-charcoal">
            {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{user?.full_name}</span>
            <span className="block truncate text-xs text-white/50">
              {user?.role ? ROLE_LABEL[user.role] : ''}
            </span>
          </span>
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconLogout width={18} height={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}
