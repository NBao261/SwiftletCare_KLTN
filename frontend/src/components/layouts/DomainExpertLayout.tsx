import {
  BasketIcon, BirdIcon, CalendarCheckIcon, ChartBarIcon,
  ClipboardTextIcon, ClockCounterClockwiseIcon, CpuIcon, CrosshairIcon,
  FileTextIcon, HeartbeatIcon, HouseIcon, LightbulbFilamentIcon, LightbulbIcon, ShieldCheckIcon,
  SlidersHorizontalIcon, SquaresFourIcon, WrenchIcon,
} from '@phosphor-icons/react'
import AppShell from '@/components/layouts/AppShell'
import { type MenuItem, type MenuSection } from '@/components/layouts/AppSidebar'

// Khung Domain Expert (FE_Design §12.5, todo-ui-layout §3.2):
// Chuyên môn 7 mục (tab gộp Tham số điều khiển + Đếm chim), Vận hành (chỉ đọc) 8 mục — thu gọn mặc định (sau C-08)
const menuSections: MenuSection[] = [
  {
    title: 'Chuyên môn',
    items: [
      { label: 'Hàng đợi việc', path: '/domain-expert/queue', icon: ClipboardTextIcon },
      { label: 'Kiểm chứng cảnh báo', path: '/domain-expert/alert-verdicts', icon: ShieldCheckIcon },
      {
        label: 'Tham số điều khiển',
        path: '/domain-expert/tuning',
        icon: SlidersHorizontalIcon,
        tabs: [
          { label: 'Ngưỡng & hệ số mờ', path: '/domain-expert/tuning' },
          { label: 'Duyệt & đề xuất', path: '/domain-expert/reviews' },
          { label: 'Hồ sơ cấu hình', path: '/domain-expert/profiles' },
          { label: 'Luật bù thời tiết', path: '/domain-expert/weather-rules' },
        ],
      },
      {
        label: 'Đếm chim',
        path: '/domain-expert/counting-schedule',
        icon: CrosshairIcon,
        tabs: [
          { label: 'Lịch đếm chim', path: '/domain-expert/counting-schedule' },
          { label: 'Vòng đếm camera', path: '/domain-expert/counting-ring' },
        ],
      },
      { label: 'Luật khuyến nghị', path: '/domain-expert/recommendation-rules', icon: LightbulbFilamentIcon },
      { label: 'Báo cáo & kết luận', path: '/domain-expert/reports', icon: FileTextIcon },
      { label: 'Lịch sử quyết định', path: '/domain-expert/history', icon: ClockCounterClockwiseIcon },
    ],
  },
  {
    title: 'Vận hành (chỉ đọc)',
    items: [
      { label: 'Tổng quan', path: '/dashboard', icon: SquaresFourIcon },
      { label: 'Giám sát đàn chim', path: '/vision', icon: BirdIcon },
      { label: 'Sức khoẻ nhà yến', path: '/health', icon: HeartbeatIcon },
      { label: 'Phân tích', path: '/analytics', icon: ChartBarIcon },
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: CpuIcon },
      { label: 'Phiếu công việc', path: '/work-orders', icon: WrenchIcon },
      { label: 'Khuyến nghị', path: '/recommendations', icon: LightbulbIcon },
      { label: 'Trang trại', path: '/farms', icon: HouseIcon },
      { label: 'Thống kê sản lượng', path: '/harvests', icon: BasketIcon },
      { label: 'Lịch bảo trì', path: '/maintenance', icon: CalendarCheckIcon },
    ],
  },
]

// Dock: §3.2 — Hàng đợi · Kiểm chứng · Tham số · Đếm chim
const dockItems: MenuItem[] = [
  menuSections[0].items[0],
  menuSections[0].items[1],
  menuSections[0].items[2],
  menuSections[0].items[3],
]

export default function DomainExpertLayout() {
  return <AppShell menuSections={menuSections} dockItems={dockItems} />
}
