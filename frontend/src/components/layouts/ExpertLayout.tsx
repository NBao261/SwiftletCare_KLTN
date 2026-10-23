import { FileText, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'
import { IconAnalytics, IconDashboard, IconSettings } from '@/components/ui/icons'

/**
 * Khung ứng dụng cho Chuyên gia nuôi yến (DOMAIN_EXPERT) — SRS v2.1.4:
 * Chuyên gia phụ trách giám sát chuyên môn, kiểm chứng cảnh báo suy luận,
 * tinh chỉnh thông số vận hành (ngưỡng, hệ số mờ, tham số phát hiện),
 * phân tích dự báo và kết luận báo cáo sức khỏe zone.
 *
 * MenuSidebar trắng 256px chuẩn hệ thống với 5 màn hình chuyên môn + Cài đặt.
 * Dock mobile lấy 4 mục đầu tiên qua firstDockItems.
 */
const menuSections: MenuSection[] = [
  {
    title: 'Chuyên môn',
    items: [
      { label: 'Tổng quan', path: '/expert/dashboard', icon: IconDashboard },
      { label: 'Kiểm chứng Cảnh báo', path: '/expert/audit-logs', icon: ShieldCheck },
      { label: 'Tinh chỉnh & Hiệu chuẩn', path: '/expert/tuning', icon: SlidersHorizontal },
      { label: 'Phân tích & Dự báo', path: '/expert/analytics', icon: IconAnalytics },
      { label: 'Báo cáo Sức khỏe', path: '/expert/reports', icon: FileText },
    ],
  },
  {
    title: 'Khác',
    items: [{ label: 'Cài đặt', path: '/settings', icon: IconSettings }],
  },
]

export default function ExpertLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
