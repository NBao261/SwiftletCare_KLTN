import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAlertStore } from '@/store/alertStore'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui'

export default function TopBar() {
  const user        = useAuthStore(s => s.user)
  const unreadCount = useAlertStore(s => s.unreadCount)
  const { logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-warmGray/15 bg-white px-6">
      <div className="text-sm text-warmGray">SwiftletCare v1.0</div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/alerts')}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-charcoal hover:bg-warmGray/10"
          aria-label="Thông báo"
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-alertRed text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-sm font-semibold text-white">
            {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="text-sm font-medium text-charcoal">{user?.full_name}</span>
        </div>

        <Button variant="secondary" size="sm" onClick={() => logout.mutate()}>
          Đăng xuất
        </Button>
      </div>
    </header>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2.5c-2.9 0-5.25 2.35-5.25 5.25v2.6l-1.2 2.2c-.3.55.1 1.2.72 1.2h11.46c.62 0 1.02-.65.72-1.2l-1.2-2.2v-2.6C15.25 4.85 12.9 2.5 10 2.5Z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
      />
      <path d="M8.2 16a1.8 1.8 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
