import {
  BasketIcon, BirdIcon, ChartBarIcon, CpuIcon, HeartbeatIcon, HouseIcon, SlidersHorizontalIcon, SquaresFourIcon, WarningIcon, WrenchIcon,
} from '@phosphor-icons/react'
import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'

// Khung Farm Technician trên web: mọi việc của thợ ở nhà được giao (G-33); dock là 4 mục đầu
const menuSections: MenuSection[] = [
  {
    title: 'Theo dõi',
    items: [
      { label: 'Cảnh báo', path: '/alerts', icon: WarningIcon },
      {
        label: 'Tổng quan',
        path: '/dashboard',
        icon: SquaresFourIcon,
        tabs: [
          { label: 'Tình trạng các nhà', path: '/dashboard' },
          { label: 'Điều khiển tay', path: '/dashboard/scada' },
        ],
      },
      {
        label: 'Đàn chim',
        path: '/vision',
        icon: BirdIcon,
        tabs: [
          { label: 'Đếm chim', path: '/vision' },
          { label: 'Vòng đếm', path: '/domain-expert/counting-ring' },
        ],
      },
      { label: 'Sức khoẻ & báo cáo', path: '/health', icon: HeartbeatIcon },
      { label: 'Phân tích', path: '/analytics', icon: ChartBarIcon },
    ],
  },
  {
    title: 'Vận hành',
    items: [
      {
        label: 'Công việc',
        path: '/work-orders',
        icon: WrenchIcon,
        tabs: [
          { label: 'Phiếu công việc', path: '/work-orders' },
          { label: 'Bảo trì định kỳ', path: '/maintenance' },
          { label: 'Khuyến nghị', path: '/recommendations' },
        ],
      },
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: CpuIcon },
      {
        // Chỉ đọc: chuyên gia và chủ nhà yến đặt, thợ đối chiếu khi làm việc tại nhà yến
        label: 'Tham số',
        path: '/domain-expert/tuning',
        icon: SlidersHorizontalIcon,
        tabs: [
          { label: 'Ngưỡng & hệ số mờ', path: '/domain-expert/tuning' },
          { label: 'Lịch đếm', path: '/domain-expert/counting-schedule' },
          { label: 'Bù thời tiết', path: '/domain-expert/weather-rules' },
        ],
      },
      { label: 'Nhà được giao', path: '/farms', icon: HouseIcon },
      { label: 'Thu hoạch', path: '/harvests', icon: BasketIcon },
    ],
  },
]

export default function TechnicianLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
