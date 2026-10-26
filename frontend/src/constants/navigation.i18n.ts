import type { Dictionary } from '@/lib/i18n'

// Từ điển nhãn menu: key là chữ tiếng Việt khai trong <Role>Layout.tsx
const vi = {
  'Vận hành': 'Vận hành',
  'Quản lý': 'Quản lý',
  'Hệ thống': 'Hệ thống',
  'Kỹ thuật': 'Kỹ thuật',
  'Khác': 'Khác',

  'Tổng quan': 'Tổng quan',
  'Tổng quan hệ thống': 'Tổng quan hệ thống',
  'Thiết bị & Cảm biến': 'Thiết bị & Cảm biến',
  'Cảnh báo': 'Cảnh báo',
  'Giám sát đàn chim': 'Giám sát đàn chim',
  'Trang trại': 'Trang trại',
  'Thống kê sản lượng': 'Thống kê sản lượng',
  'Phân tích': 'Phân tích',
  'Thông báo': 'Thông báo',
  'Cài đặt': 'Cài đặt',
  'Người dùng': 'Người dùng',
  'Yêu cầu tài khoản': 'Yêu cầu tài khoản',
  'Cấu hình mặc định': 'Cấu hình mặc định',
  'Nhật ký hệ thống': 'Nhật ký hệ thống',
  'Lắp đặt thiết bị': 'Lắp đặt thiết bị',
  'OTA Firmware': 'OTA Firmware',
  'Lịch bảo trì': 'Lịch bảo trì',

  'Xin chào,': 'Xin chào,',
  'Đăng xuất': 'Đăng xuất',
  'Điều hướng chính': 'Điều hướng chính',

  'Quản trị viên': 'Quản trị viên',
  'Chủ nhà yến': 'Chủ nhà yến',
  'Kỹ thuật viên': 'Kỹ thuật viên',
  'Nhân viên kinh doanh': 'Nhân viên kinh doanh',
}

type NavigationKey = keyof typeof vi

const en: Record<NavigationKey, string> = {
  'Vận hành': 'Operations',
  'Quản lý': 'Management',
  'Hệ thống': 'System',
  'Kỹ thuật': 'Technical',
  'Khác': 'Other',

  'Tổng quan': 'Overview',
  'Tổng quan hệ thống': 'System overview',
  'Thiết bị & Cảm biến': 'Devices & Sensors',
  'Cảnh báo': 'Alerts',
  'Giám sát đàn chim': 'Bird monitoring',
  'Trang trại': 'Farms',
  'Thống kê sản lượng': 'Yield statistics',
  'Phân tích': 'Analytics',
  'Thông báo': 'Notifications',
  'Cài đặt': 'Settings',
  'Người dùng': 'Users',
  'Yêu cầu tài khoản': 'Account requests',
  'Cấu hình mặc định': 'Default settings',
  'Nhật ký hệ thống': 'Audit log',
  'Lắp đặt thiết bị': 'Device installation',
  'OTA Firmware': 'OTA Firmware',
  'Lịch bảo trì': 'Maintenance schedule',

  'Xin chào,': 'Hello,',
  'Đăng xuất': 'Log out',
  'Điều hướng chính': 'Main navigation',

  'Quản trị viên': 'Administrator',
  'Chủ nhà yến': 'Farm Owner',
  'Kỹ thuật viên': 'Technician',
  'Nhân viên kinh doanh': 'Sales Staff',
}

export const navigationDict: Dictionary<NavigationKey> = { vi, en }

export function isNavigationKey(label: string): label is NavigationKey {
  return label in vi
}
