import { useLocation, useNavigate } from 'react-router-dom'
import { useAlertStore } from '@/store/alertStore'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { usePermission } from '@/hooks/usePermission'
import ZoneSwitcher from './ZoneSwitcher'
import { IconBell, IconLogout } from '@/components/ui/icons'
import { ALL_NAV_ITEMS } from './navItems'

/** Tiêu đề trang theo route hiện tại — không lọc theo role vì tên trang không đổi tuỳ người xem */
function usePageTitle(): string {
  const { pathname } = useLocation()
  const match = ALL_NAV_ITEMS.find(i => pathname === i.to || pathname.startsWith(`${i.to}/`))
  return match?.label ?? 'SwiftletCare'
}

export default function TopBar() {
  const unreadCount = useAlertStore(s => s.unreadCount)
  const user = useAuthStore(s => s.user)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const title = usePageTitle()
  // Khớp RequireRole của route /alerts — Sales Staff không có trang này nên không hiện nút
  const canViewAlerts = usePermission('FARM_OWNER', 'TECHNICIAN', 'ADMIN')

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-warmGray/15 bg-white px-4 lg:px-6">
      {/* Trái: tên trang (desktop) / thương hiệu (mobile, vì sidebar bị ẩn) */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal text-sm font-extrabold text-white lg:hidden">
          S
        </span>
        <h1 className="truncate text-lg font-bold tracking-tight text-charcoal">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ZoneSwitcher />

        {canViewAlerts && (
          <button
            onClick={() => navigate('/alerts')}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-warmGray/10"
            aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'}
          >
            <IconBell />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alertRed px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Mobile: sidebar (chứa avatar + đăng xuất) bị ẩn nên đưa ra đây */}
        <button
          onClick={() => logout.mutate()}
          aria-label="Đăng xuất"
          title={user?.full_name ? `Đăng xuất ${user.full_name}` : 'Đăng xuất'}
          className="flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-warmGray/10 lg:hidden"
        >
          <IconLogout />
        </button>
      </div>
    </header>
  )
}
