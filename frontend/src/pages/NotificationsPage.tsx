import { useState } from 'react'
import { CheckIcon } from '@phosphor-icons/react'
import NotificationRow from '@/components/common/NotificationRow'
import StatusTabs from '@/components/common/StatusTabs'
import { Button, EmptyState, LoadingSkeleton, SectionCard } from '@/components/ui'
import { shellDict } from '@/constants/shell.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useMarkAllNotificationsRead, useNotificationsInfinite } from '@/hooks/shared/useNotifications'
import { useOpenNotification } from '@/hooks/shared/useOpenNotification'
import { useToastStore } from '@/stores/toastStore'

const PAGE_SIZE = 20

type NotificationTab = 'all' | 'unread'

// Trang Thông báo của mọi vai trò: toàn bộ thông báo trong ứng dụng, lọc chưa đọc; mở từ chân popup chuông
export default function NotificationsPage(): JSX.Element {
  const { t } = useTranslation(shellDict)
  const [tab, setTab] = useState<NotificationTab>('all')
  const inbox = useNotificationsInfinite(PAGE_SIZE, true, tab === 'unread')
  const markAllRead = useMarkAllNotificationsRead()
  const open = useOpenNotification()
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const notifications = inbox.data?.pages.flatMap(page => page.data) ?? []
  const unreadCount = inbox.data?.pages[0]?.meta?.unreadCount ?? 0

  let body = (
    <div className="overflow-hidden rounded-2xl border border-warmGray/15">
      {notifications.map(notification => <NotificationRow key={notification._id} notification={notification} onOpen={open} />)}
    </div>
  )
  if (inbox.isLoading) body = <LoadingSkeleton count={4} className="h-16 w-full" />
  if (inbox.isError) {
    body = (
      <EmptyState
        title={apiErrorMessage(inbox.error, t('notif.loadFailed'))}
        action={<Button variant="secondary" size="sm" onClick={() => void inbox.refetch()}>{t('notif.retry')}</Button>}
      />
    )
  }
  if (!inbox.isLoading && !inbox.isError && notifications.length === 0) {
    body = <EmptyState title={t(tab === 'unread' ? 'notifPage.emptyUnread' : 'notif.inboxEmpty')} />
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <SectionCard
        description={t('notifPage.subtitle')}
        action={unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate(undefined, { onError: error => push(apiErrorMessage(error, t('notif.markFailed')), 'error') })}
          >
            <CheckIcon size={14} weight="bold" />
            {t('notif.markAllRead')}
          </Button>
        )}
      >
        <StatusTabs
          variant="underline"
          ariaLabel={t('notifPage.tabsAria')}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'all', label: t('notifPage.tabAll') },
            { id: 'unread', label: t('notifPage.tabUnread'), badge: unreadCount },
          ]}
        />
        {body}
        {inbox.hasNextPage && (
          <Button variant="secondary" size="sm" className="self-center" loading={inbox.isFetchingNextPage} onClick={() => void inbox.fetchNextPage()}>
            {t('notif.loadMore')}
          </Button>
        )}
      </SectionCard>
    </div>
  )
}
