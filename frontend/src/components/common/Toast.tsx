import { CheckCircleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react'
import { useToastStore } from '@/stores/toastStore'
import { cn } from '@/lib/cn'
import { t, tr } from '@/i18n'

// Toast – container hiển thị toàn bộ thông báo, mount 1 lần ở AppShell.
// Vùng aria-live luôn có mặt để trình đọc màn hình nhận thông báo mới; lỗi dùng role="alert" để đọc ngay
export default function Toast() {
  const toasts = useToastStore(s => s.toasts)
  const dismiss = useToastStore(s => s.dismiss)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full sm:max-w-sm"
    >
      {toasts.map(toast => {
        const isError = toast.tone === 'error'
        const Icon = isError ? WarningCircleIcon : CheckCircleIcon
        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex animate-fade-in items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-dock',
              isError ? 'bg-alertRed' : 'bg-charcoal',
            )}
          >
            <Icon size={20} weight="fill" aria-hidden className="mt-px shrink-0" />
            {/* Câu thông báo tự dịch theo VI/EN (câu đã dịch sẵn thì giữ nguyên) */}
            <p className="min-w-0 flex-1 break-words text-left">{tr(toast.message)}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t('Đóng')}
              className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            >
              <XIcon size={16} weight="bold" aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}
