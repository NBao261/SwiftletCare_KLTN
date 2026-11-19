import type { Dictionary } from '@/lib/i18n'

// Từ điển nhãn menu: key là chữ tiếng Việt khai trong <Role>Layout.tsx — mọi nhãn menu phải có ở đây, thiếu thì bản EN hiện tiếng Việt
const vi = {
  'Vận hành': 'Vận hành',
  'Vận hành (chỉ đọc)': 'Vận hành (chỉ đọc)',
  'Quản lý': 'Quản lý',
  'Hệ thống': 'Hệ thống',
  'Console thiết bị': 'Console thiết bị',
  'Chuyên môn': 'Chuyên môn',
  'Khác': 'Khác',

  'Tổng quan': 'Tổng quan',
  'Tổng quan hệ thống': 'Tổng quan hệ thống',
  'Tổng quan trại': 'Tổng quan trại',
  'Thiết bị & Cảm biến': 'Thiết bị & Cảm biến',
  'Danh sách thiết bị': 'Danh sách thiết bị',
  'Cảnh báo': 'Cảnh báo',
  'Giám sát đàn chim': 'Giám sát đàn chim',
  'Trang trại': 'Trang trại',
  'Thống kê sản lượng': 'Thống kê sản lượng',
  'Phân tích': 'Phân tích',
  'Sức khỏe nhà yến': 'Sức khỏe nhà yến',
  'Phiếu công việc': 'Phiếu công việc',
  'Khuyến nghị': 'Khuyến nghị',
  'Lịch bảo trì': 'Lịch bảo trì',
  'Cài đặt': 'Cài đặt',
  'Người dùng': 'Người dùng',
  'Yêu cầu tài khoản': 'Yêu cầu tài khoản',
  'Kho thiết bị': 'Kho thiết bị',
  'Cấu hình mặc định': 'Cấu hình mặc định',
  'Nhật ký hệ thống': 'Nhật ký hệ thống',
  'OTA Firmware': 'OTA Firmware',

  'Hàng đợi việc': 'Hàng đợi việc',
  'Thẩm định cảnh báo': 'Thẩm định cảnh báo',
  'Ngưỡng & hệ số mờ': 'Ngưỡng & hệ số mờ',
  'Lịch đếm chim': 'Lịch đếm chim',
  'Vòng đếm camera': 'Vòng đếm camera',
  'Luật bù thời tiết': 'Luật bù thời tiết',
  'Duyệt & đề xuất': 'Duyệt & đề xuất',
  'Báo cáo & kết luận': 'Báo cáo & kết luận',
  'Hồ sơ cấu hình': 'Hồ sơ cấu hình',
  'Luật khuyến nghị': 'Luật khuyến nghị',
  'Lịch sử quyết định': 'Lịch sử quyết định',

  'Xin chào,': 'Xin chào,',
  'Vai trò:': 'Vai trò:',
  'Đăng xuất': 'Đăng xuất',
  'Điều hướng chính': 'Điều hướng chính',
}

type NavigationKey = keyof typeof vi

const en: Record<NavigationKey, string> = {
  'Vận hành': 'Operations',
  'Vận hành (chỉ đọc)': 'Operations (read-only)',
  'Quản lý': 'Management',
  'Hệ thống': 'System',
  'Console thiết bị': 'Device console',
  'Chuyên môn': 'Expert work',
  'Khác': 'Other',

  'Tổng quan': 'Overview',
  'Tổng quan hệ thống': 'System overview',
  'Tổng quan trại': 'Farm overview',
  'Thiết bị & Cảm biến': 'Devices & Sensors',
  'Danh sách thiết bị': 'Devices',
  'Cảnh báo': 'Alerts',
  'Giám sát đàn chim': 'Bird monitoring',
  'Trang trại': 'Farms',
  'Thống kê sản lượng': 'Yield statistics',
  'Phân tích': 'Analytics',
  'Sức khỏe nhà yến': 'House health',
  'Phiếu công việc': 'Work orders',
  'Khuyến nghị': 'Recommendations',
  'Lịch bảo trì': 'Maintenance schedule',
  'Cài đặt': 'Settings',
  'Người dùng': 'Users',
  'Yêu cầu tài khoản': 'Account requests',
  'Kho thiết bị': 'Device stock',
  'Cấu hình mặc định': 'Default settings',
  'Nhật ký hệ thống': 'Audit log',
  'OTA Firmware': 'OTA Firmware',

  'Hàng đợi việc': 'Work queue',
  'Thẩm định cảnh báo': 'Alert verdicts',
  'Ngưỡng & hệ số mờ': 'Thresholds & fuzzy coefficients',
  'Lịch đếm chim': 'Counting schedule',
  'Vòng đếm camera': 'Counting ring',
  'Luật bù thời tiết': 'Weather compensation rules',
  'Duyệt & đề xuất': 'Reviews & proposals',
  'Báo cáo & kết luận': 'Reports & conclusions',
  'Hồ sơ cấu hình': 'Configuration profiles',
  'Luật khuyến nghị': 'Recommendation rules',
  'Lịch sử quyết định': 'Decision history',

  'Xin chào,': 'Hello,',
  'Vai trò:': 'Role:',
  'Đăng xuất': 'Log out',
  'Điều hướng chính': 'Main navigation',
}

export const navigationDict: Dictionary<NavigationKey> = { vi, en }

export function isNavigationKey(label: string): label is NavigationKey {
  return label in vi
}
