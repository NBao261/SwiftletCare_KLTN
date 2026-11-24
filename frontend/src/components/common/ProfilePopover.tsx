import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck, UserCog } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/auth/useAuth'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/hooks/common/useTranslation'
import { shellDict } from '@/constants/shell.i18n'
import Avatar from '@/components/ui/Avatar'
import LanguageToggle from '@/components/common/LanguageToggle'
import { ROLE_LABEL } from '@/constants/roles'

// Popup tài khoản khi bấm avatar
export default function ProfilePopover() {
  const { t } = useTranslation(shellDict)
  const user = useAuthStore(s => s.user)
  const { logout } = useAuth()
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
    <div ref={containerRef} className="relative">
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
              <p className="truncate text-small text-warmGray">{user.email}</p>
              <p className="truncate text-small text-warmGray">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>

          {/* Điện thoại: công tắc VI/EN rời header vào đây (SH-05) */}
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5 sm:hidden">
            <span className="text-sm font-medium text-charcoal">{t('lang.label')}</span>
            <LanguageToggle />
          </div>

          <div className="space-y-0.5 p-1.5">
            <MenuItem icon={<UserCog width={16} height={16} />} label={t('profile.accountSettings')} onClick={() => goTo('/settings')} />
            <MenuItem icon={<ShieldCheck width={16} height={16} />} label={t('profile.privacy')} onClick={() => goTo('/settings/privacy')} />
          </div>

          <div className="border-t border-gray-200 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); logout.mutate() }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 max-sm:min-h-11 text-left text-sm font-medium text-safetyOrange transition-colors hover:bg-safetyOrange/10 disabled:cursor-not-allowed disabled:opacity-50"
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

function MenuItem({ icon, label, onClick }: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 max-sm:min-h-11 text-left text-sm font-medium text-charcoal transition-colors hover:bg-charcoal/5"
    >
      <span className="text-warmGray">{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  )
}
