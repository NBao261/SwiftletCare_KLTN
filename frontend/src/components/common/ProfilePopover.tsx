import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CircleHelp, LogOut, ShieldCheck, UserCog } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useLogoutConfirmStore } from '@/stores/logoutConfirmStore'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/hooks/common/useTranslation'
import { shellDict } from '@/constants/shell.i18n'
import Avatar from '@/components/ui/Avatar'

// Popup tài khoản khi bấm avatar: tên, email và lối tắt cài đặt, đăng xuất
export default function ProfilePopover() {
  const { t } = useTranslation(shellDict)
  const user = useAuthStore(s => s.user)
  const askLogout = useLogoutConfirmStore(s => s.ask)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  function goTo(path: string) {
    setOpen(false)
    navigate(path)
  }

  return (
    <div ref={containerRef} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('profile.ariaUser', { name: user.full_name })}
        className={cn(
          'rounded-full transition-shadow',
          open ? 'ring-2 ring-limeMist ring-offset-2 ring-offset-stone' : 'hover:ring-2 hover:ring-charcoal/15',
        )}
      >
        <Avatar name={user.full_name} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('profile.aria')}
          className="absolute right-0 z-30 mt-2 w-[260px] animate-fade-in overflow-hidden rounded-2xl glass-panel"
        >
          <div className="flex items-center gap-3 border-b border-gray-200 p-4">
            <Avatar name={user.full_name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-charcoal">{user.full_name}</p>
              <p className="truncate text-xs text-warmGray">{user.email}</p>
            </div>
          </div>

          <div className="space-y-0.5 p-1.5">
            <MenuItem icon={<UserCog width={16} height={16} />} label={t('profile.accountSettings')} onClick={() => goTo('/settings')} />
            <MenuItem icon={<Bell width={16} height={16} />} label={t('profile.notificationSettings')} onClick={() => goTo('/settings')} />
            <MenuItem icon={<CircleHelp width={16} height={16} />} label={t('profile.help')} badge={t('profile.comingSoon')} disabled />
            <MenuItem icon={<ShieldCheck width={16} height={16} />} label={t('profile.privacy')} onClick={() => goTo('/settings/privacy')} />
          </div>

          <div className="border-t border-gray-200 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); askLogout() }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-safetyOrange transition-colors hover:bg-safetyOrange/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut width={16} height={16} />
              {t('logout.action')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, badge, disabled, onClick }: {
  icon: ReactNode
  label: string
  badge?: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-charcoal transition-colors hover:bg-charcoal/5 disabled:cursor-not-allowed disabled:text-warmGray disabled:hover:bg-transparent"
    >
      <span className="text-warmGray">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && <span className="rounded-full bg-charcoal/5 px-2 py-0.5 text-[10px] font-semibold text-warmGray">{badge}</span>}
    </button>
  )
}
