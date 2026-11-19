import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from '@/hooks/common/useTranslation'
import { shellDict } from '@/constants/shell.i18n'
import { notificationTarget } from '@/constants/notificationTargets'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsInfinite } from '@/hooks/shared/useNotifications'
import type { AppNotification } from '@/types'

const PAGE_SIZE = 10

// Tab "Thông báo" của chuông: hộp thông báo trong ứng dụng (EXPERT-FR-007, 009) — bấm để đánh dấu đã đọc và mở trang liên quan
export default function NotificationInboxList({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation(shellDict)
  const navigate = useNavigate()
  const role = useAuthStore(s => s.user?.role)
  const inbox = useNotificationsInfinite(PAGE_SIZE, true)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const onMarkFailed = (error: unknown) => push(apiErrorMessage(error, t('notif.markFailed')), 'error')
  const notifications = inbox.data?.pages.flatMap(page => page.data) ?? []
  const unreadCount = inbox.data?.pages[0]?.meta?.unreadCount ?? 0

  function open(notification: AppNotification) {
    if (!notification.read_at) markRead.mutate(notification._id, { onError: onMarkFailed })
    const target = notificationTarget(notification, role)
    if (!target) return
    onNavigate()
    navigate(target.path, target.state ? { state: target.state } : undefined)
  }

  return (
    <>
      {unreadCount > 0 && (
        <div className="flex justify-end border-b border-charcoal/10 px-4 py-2">
          <button
            type="button"
            onClick={() => markAllRead.mutate(undefined, { onError: onMarkFailed })}
            disabled={markAllRead.isPending}
            className="text-xs text-warmGray underline transition-colors hover:text-charcoal disabled:opacity-50"
          >
            {t('notif.markAllRead')}
          </button>
        </div>
      )}
      <div className="max-h-[380px] overflow-y-auto [scrollbar-color:theme(colors.gray.300)_transparent] [scrollbar-width:thin]">
        {inbox.isLoading && <p className="px-4 py-8 text-center text-sm text-warmGray">{t('notif.loading')}</p>}
        {/* Lỗi tải: báo lỗi kèm thử lại, không hiện như hộp rỗng (FE_Design 13.5) */}
        {inbox.isError && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <p className="text-sm text-warmGray">{apiErrorMessage(inbox.error, t('notif.loadFailed'))}</p>
            <button type="button" onClick={() => void inbox.refetch()} className="text-xs font-semibold text-charcoal underline">
              {t('notif.retry')}
            </button>
          </div>
        )}
        {!inbox.isLoading && !inbox.isError && notifications.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-warmGray">{t('notif.inboxEmpty')}</p>
        )}
        {notifications.map(notification => {
          const unread = !notification.read_at
          return (
            <button
              key={notification._id}
              type="button"
              onClick={() => open(notification)}
              className={cn(
                'flex w-full items-start gap-3 border-b p-3.5 text-left transition-colors',
                unread ? 'border-charcoal/10 bg-charcoal/5 hover:bg-charcoal/10' : 'border-charcoal/5 opacity-80 hover:bg-charcoal/5',
              )}
            >
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', unread ? 'bg-safetyOrange' : 'bg-transparent')} />
              <span className="min-w-0 flex-1">
                <span className={cn('block whitespace-normal break-words text-sm', unread ? 'font-bold text-charcoal' : 'font-medium text-graphite')}>
                  {notification.title}
                </span>
                <span className="mt-1 block whitespace-normal break-words text-xs text-gray-600">{notification.body}</span>
                <span className="mt-1 block text-xs text-warmGray">{formatDateTime(notification.created_at)}</span>
              </span>
            </button>
          )
        })}
        {inbox.hasNextPage && (
          <button
            type="button"
            onClick={() => void inbox.fetchNextPage()}
            disabled={inbox.isFetchingNextPage}
            className="block w-full py-3 text-center text-xs text-warmGray hover:text-charcoal disabled:opacity-50"
          >
            {inbox.isFetchingNextPage ? t('notif.loadingMore') : t('notif.loadMore')}
          </button>
        )}
      </div>
    </>
  )
}
