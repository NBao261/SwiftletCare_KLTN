import { useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/hooks/auth/useAuth'
import { useLogoutConfirmStore } from '@/stores/logoutConfirmStore'
import { useTranslation } from '@/hooks/common/useTranslation'
import { shellDict } from '@/constants/shell.i18n'

// Popup xác nhận đăng xuất dùng chung, mở qua logoutConfirmStore
export default function LogoutConfirmModal() {
  const open = useLogoutConfirmStore(s => s.open)
  const close = useLogoutConfirmStore(s => s.close)
  const { logout } = useAuth()
  const { t } = useTranslation(shellDict)

  // Đăng xuất chuyển sang /login và gỡ khung app trước khi API trả về (callback onSettled của mutate không chạy) → đóng popup khi bị gỡ
  useEffect(() => close, [close])

  return (
    <Modal open={open} onClose={close} title={t('logout.title')} className="max-w-sm">
      <p className="-mt-2.5 mb-6 text-sm text-gray-600">{t('logout.desc')}</p>
      <div className="flex justify-start gap-3 pb-2">
        <button
          type="button"
          onClick={close}
          disabled={logout.isPending}
          className="min-w-[110px] rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-charcoal transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('logout.cancel')}
        </button>
        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSettled: close })}
          disabled={logout.isPending}
          className="min-w-[110px] rounded-xl bg-safetyOrange px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {logout.isPending ? t('logout.pending') : t('logout.action')}
        </button>
      </div>
    </Modal>
  )
}
