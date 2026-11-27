import type { Dictionary } from '@/lib/i18n'
import { prefixLabels, alertStatusDict } from '@/constants/enumLabels.i18n'
import { levelDict, severityLabels } from '@/constants/severity.i18n'

// Từ điển popup thông báo, tài khoản, đăng xuất và nút ngôn ngữ
const vi = {
  'notif.title': 'Thông báo',
  'notif.ariaUnread': 'Thông báo ({count} cần xem)',
  'notif.sortByTime': 'Xếp theo thời gian',
  'notif.pendingFirst': 'Chưa xác nhận lên đầu',
  'notif.tabsAria': 'Cảnh báo hoặc thông báo trong ứng dụng',
  'notif.pendingSummary': 'Chờ xác nhận: {count}',
  'notif.unreadSummary': '{count} chưa đọc',
  'notif.allRead': 'Đã đọc hết',
  'notif.viewAllAlerts': 'Xem tất cả cảnh báo →',
  'notif.settings': 'Cài đặt thông báo',
  'notifPage.subtitle': 'Tin gửi riêng cho bạn: việc cần làm, nhắc việc và kết quả quyết định.',
  'notifPage.tabsAria': 'Tất cả hoặc chưa đọc',
  'notifPage.tabAll': 'Tất cả',
  'notifPage.tabUnread': 'Chưa đọc',
  'notifPage.emptyUnread': 'Không còn thông báo chưa đọc',
  'notif.loading': 'Đang tải...',
  'notif.loadingMore': 'Đang tải thêm...',
  'notif.empty': 'Chưa có thông báo nào',
  'notif.viewAll': 'Xem tất cả thông báo →',
  'notif.tabAlerts': 'Cảnh báo',
  'notif.tabInbox': 'Thông báo',
  'notif.inboxEmpty': 'Chưa có thông báo nào trong ứng dụng',
  'notif.markAllRead': 'Đánh dấu đã đọc hết',
  'notif.loadFailed': 'Không tải được thông báo',
  'notif.retry': 'Thử lại',
  'notif.markFailed': 'Không đánh dấu đã đọc được',
  'notif.loadMore': 'Tải thêm',
  ...prefixLabels('status.', alertStatusDict.vi),
  ...prefixLabels('severity.', severityLabels(levelDict.vi)),

  'profile.aria': 'Tài khoản',
  'profile.ariaUser': 'Tài khoản {name}',
  'profile.accountSettings': 'Cài đặt tài khoản',
  'profile.privacy': 'Chính sách quyền riêng tư',

  'logout.action': 'Đăng xuất',

  'lang.label': 'Ngôn ngữ hiển thị',
  'lang.switch': 'Chuyển sang tiếng Anh',
}

type ShellKey = keyof typeof vi

const en: Record<ShellKey, string> = {
  'notif.title': 'Notifications',
  'notif.ariaUnread': 'Notifications ({count} to see)',
  'notif.sortByTime': 'Sort by time',
  'notif.pendingFirst': 'Not acknowledged first',
  'notif.tabsAria': 'Alerts or in-app notifications',
  'notif.pendingSummary': 'Waiting: {count}',
  'notif.unreadSummary': '{count} unread',
  'notif.allRead': 'All read',
  'notif.viewAllAlerts': 'View all alerts →',
  'notif.settings': 'Notification settings',
  'notifPage.subtitle': 'Messages sent to you: things to do, reminders and the result of decisions.',
  'notifPage.tabsAria': 'All or unread',
  'notifPage.tabAll': 'All',
  'notifPage.tabUnread': 'Unread',
  'notifPage.emptyUnread': 'No unread notification left',
  'notif.loading': 'Loading...',
  'notif.loadingMore': 'Loading more...',
  'notif.empty': 'No notifications yet',
  'notif.viewAll': 'View all notifications →',
  'notif.tabAlerts': 'Alerts',
  'notif.tabInbox': 'Notifications',
  'notif.inboxEmpty': 'No in-app notifications yet',
  'notif.markAllRead': 'Mark all as read',
  'notif.loadFailed': 'Could not load the notifications',
  'notif.retry': 'Try again',
  'notif.markFailed': 'Could not mark as read',
  'notif.loadMore': 'Load more',
  ...prefixLabels('status.', alertStatusDict.en),
  ...prefixLabels('severity.', severityLabels(levelDict.en)),

  'profile.aria': 'Account',
  'profile.ariaUser': 'Account {name}',
  'profile.accountSettings': 'Account settings',
  'profile.privacy': 'Privacy policy',

  'logout.action': 'Log out',

  'lang.label': 'Display language',
  'lang.switch': 'Switch to Vietnamese',
}

export const shellDict: Dictionary<ShellKey> = { vi, en }
