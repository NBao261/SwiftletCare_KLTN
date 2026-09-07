import { useAuthStore } from '@/store/authStore'
import { useAlertStore } from '@/store/alertStore'

export default function TopBar() {
  const user        = useAuthStore(s => s.user)
  const unreadCount = useAlertStore(s => s.unreadCount)

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
      <div className="text-slate-400 text-sm">SwiftletCare v1.0</div>
      <div className="flex items-center gap-4">
        {/* Alert bell */}
        <button className="relative text-slate-400 hover:text-slate-100">
          <span className="text-xl">🔔</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-sm font-semibold">
            {user?.full_name?.[0] ?? 'U'}
          </div>
          <span className="text-sm text-slate-300">{user?.full_name}</span>
        </div>
      </div>
    </header>
  )
}
