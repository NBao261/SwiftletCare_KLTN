import { CaretRightIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/i18n'
import { notificationTarget } from '@/constants/notificationTargets'
import { useAuthStore } from '@/stores/authStore'
import type { AppNotification } from '@/types'

// Một thông báo trong ứng dụng: chấm cam khi chưa đọc, mũi tên khi bấm sẽ mở trang liên quan
export default function NotificationRow({ notification, onOpen }: { notification: AppNotification; onOpen: (notification: AppNotification) => void }): JSX.Element {
  const role = useAuthStore(state => state.user?.role)
  const unread = !notification.read_at
  const hasTarget = notificationTarget(notification, role) !== null

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'flex w-full items-start gap-3 border-b p-3.5 text-left transition-colors',
        unread ? 'border-charcoal/10 bg-charcoal/5 hover:bg-charcoal/10' : 'border-charcoal/5 hover:bg-charcoal/5',
      )}
    >
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', unread ? 'bg-safetyOrange' : 'bg-transparent')} />
      <span className="min-w-0 flex-1">
        <span className={cn('block whitespace-normal break-words text-sm', unread ? 'font-bold text-charcoal' : 'font-medium text-graphite')}>{notification.title}</span>
        <span className="mt-1 block whitespace-normal break-words text-xs text-graphite">{notification.body}</span>
        <span className="mt-1 block text-xs text-warmGray">{formatDateTime(notification.created_at)}</span>
      </span>
      {hasTarget && <CaretRightIcon size={16} className="mt-0.5 shrink-0 text-warmGray" aria-hidden />}
    </button>
  )
}
