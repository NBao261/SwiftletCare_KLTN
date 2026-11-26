import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { shellDict } from '@/constants/shell.i18n'
import { useNotificationsInfinite } from '@/hooks/shared/useNotifications'
import { useOpenNotification } from '@/hooks/shared/useOpenNotification'
import NotificationRow from '@/components/common/NotificationRow'

// Chỉ các thông báo mới nhất; đọc hết thì "Xem tất cả thông báo" ở chân popup mở trang Thông báo
const POPOVER_PAGE_SIZE = 8

// Tab "Thông báo" của chuông: bấm một thông báo để đánh dấu đã đọc và mở trang liên quan
export default function NotificationInboxList({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation(shellDict)
  const apiErrorMessage = useApiErrorMessage()
  const inbox = useNotificationsInfinite(POPOVER_PAGE_SIZE, true)
  const open = useOpenNotification(onNavigate)
  const notifications = inbox.data?.pages[0]?.data ?? []

  return (
    <div className="max-h-[380px] overflow-y-auto [scrollbar-color:theme(colors.gray.300)_transparent] [scrollbar-width:thin]">
      {inbox.isLoading && <p className="px-4 py-8 text-center text-sm text-warmGray">{t('notif.loading')}</p>}
      {/* Lỗi tải: báo lỗi kèm thử lại, không hiện như hộp rỗng (FE_Design 13.5) */}
      {inbox.isError && (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <p className="text-sm text-warmGray">{apiErrorMessage(inbox.error, t('notif.loadFailed'))}</p>
          <button type="button" onClick={() => void inbox.refetch()} className="text-xs font-semibold text-charcoal underline">{t('notif.retry')}</button>
        </div>
      )}
      {!inbox.isLoading && !inbox.isError && notifications.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-warmGray">{t('notif.inboxEmpty')}</p>
      )}
      {notifications.map(notification => <NotificationRow key={notification._id} notification={notification} onOpen={open} />)}
    </div>
  )
}
