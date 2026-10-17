import type { Dictionary } from '@/lib/i18n'
import { prefixLabels, alertStatusDict } from '@/constants/enumLabels.i18n'
import { levelDict, severityLabels } from '@/constants/severity.i18n'

// Từ điển popup thông báo, tài khoản, đăng xuất và nút ngôn ngữ
const vi = {
  'notif.title': 'Thông báo',
  'notif.ariaUnread': 'Thông báo ({count} chưa đọc)',
  'notif.sortByTime': 'Xếp theo thời gian',
  'notif.unreadFirst': 'Chưa đọc lên đầu',
  'notif.loading': 'Đang tải...',
  'notif.loadingMore': 'Đang tải thêm...',
  'notif.empty': 'Chưa có thông báo nào',
  'notif.severity': 'Mức độ',
  'notif.status': 'Trạng thái',
  'notif.acknowledgedAt': 'Tiếp nhận lúc',
  'notif.note': 'Ghi chú',
  'notif.openDetail': 'Mở trang chi tiết cảnh báo',
  'notif.viewAll': 'Xem tất cả thông báo →',
  ...prefixLabels('status.', alertStatusDict.vi),
  ...prefixLabels('severity.', severityLabels(levelDict.vi)),

  'profile.aria': 'Tài khoản',
  'profile.ariaUser': 'Tài khoản {name}',
  'profile.accountSettings': 'Cài đặt tài khoản',
  'profile.notificationSettings': 'Cấu hình thông báo',
  'profile.help': 'Trợ giúp & Hướng dẫn',
  'profile.comingSoon': 'Sắp có',

  'logout.action': 'Đăng xuất',
  'logout.actionUser': 'Đăng xuất {name}',
  'logout.pending': 'Đang đăng xuất...',
  'logout.title': 'Xác nhận đăng xuất',
  'logout.desc': 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản SwiftletCare?',
  'logout.cancel': 'Hủy bỏ',

  'lang.label': 'Ngôn ngữ hiển thị',
  'lang.current': 'Tiếng Việt',
  'lang.switch': 'Chuyển sang tiếng Anh',
}

type ShellKey = keyof typeof vi

const en: Record<ShellKey, string> = {
  'notif.title': 'Notifications',
  'notif.ariaUnread': 'Notifications ({count} unread)',
  'notif.sortByTime': 'Sort by time',
  'notif.unreadFirst': 'Unread first',
  'notif.loading': 'Loading...',
  'notif.loadingMore': 'Loading more...',
  'notif.empty': 'No notifications yet',
  'notif.severity': 'Severity',
  'notif.status': 'Status',
  'notif.acknowledgedAt': 'Acknowledged at',
  'notif.note': 'Note',
  'notif.openDetail': 'Open alert details',
  'notif.viewAll': 'View all notifications →',
  ...prefixLabels('status.', alertStatusDict.en),
  ...prefixLabels('severity.', severityLabels(levelDict.en)),

  'profile.aria': 'Account',
  'profile.ariaUser': 'Account {name}',
  'profile.accountSettings': 'Account settings',
  'profile.notificationSettings': 'Notification settings',
  'profile.help': 'Help & Support',
  'profile.comingSoon': 'Soon',

  'logout.action': 'Log out',
  'logout.actionUser': 'Log out {name}',
  'logout.pending': 'Logging out...',
  'logout.title': 'Confirm log out',
  'logout.desc': 'Are you sure you want to log out of your SwiftletCare account?',
  'logout.cancel': 'Cancel',

  'lang.label': 'Display language',
  'lang.current': 'English',
  'lang.switch': 'Switch to Vietnamese',
}

export const shellDict: Dictionary<ShellKey> = { vi, en }
