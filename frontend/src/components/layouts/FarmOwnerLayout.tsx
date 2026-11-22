import {
  BasketIcon, BirdIcon, ChartBarIcon, CpuIcon, HeartbeatIcon, HouseIcon, ShieldCheckIcon, SquaresFourIcon, WarningIcon, WrenchIcon,
} from '@phosphor-icons/react'
import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'

// Khung Farm Owner; 4 mục đầu là dock điện thoại
const menuSections: MenuSection[] = [
  {
    title: 'Theo dõi',
    items: [
      {
        label: 'Tổng quan',
        path: '/dashboard',
        icon: SquaresFourIcon,
        tabs: [
          { label: 'Tình trạng các nhà', path: '/dashboard' },
          { label: 'So sánh nhà', path: '/overview' },
          { label: 'Điều khiển tay', path: '/dashboard/scada' },
        ],
      },
      { label: 'Cảnh báo', path: '/alerts', icon: WarningIcon },
      { label: 'Đàn chim', path: '/vision', icon: BirdIcon },
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
      { label: 'Thiết bị', path: '/devices', icon: CpuIcon },
      { label: 'Trang trại', path: '/farms', icon: HouseIcon },
      { label: 'Thu hoạch', path: '/harvests', icon: BasketIcon },
    ],
  },
  {
    // Trang quyết định của chuyên gia: trang trại chưa có chuyên gia thì Farm Owner quyết định thay, có thì xem
    title: 'Chuyên môn',
    items: [
      {
        label: 'Chuyên môn',
        path: '/domain-expert/alert-verdicts',
        icon: ShieldCheckIcon,
        tabs: [
          { label: 'Kiểm chứng cảnh báo', path: '/domain-expert/alert-verdicts' },
          { label: 'Ngưỡng & hệ số mờ', path: '/domain-expert/tuning' },
          { label: 'Duyệt & đề xuất', path: '/domain-expert/reviews' },
          { label: 'Hồ sơ cấu hình', path: '/domain-expert/profiles' },
          { label: 'Bù thời tiết', path: '/domain-expert/weather-rules' },
          { label: 'Lịch đếm', path: '/domain-expert/counting-schedule' },
          { label: 'Vòng đếm', path: '/domain-expert/counting-ring' },
          { label: 'Luật khuyến nghị', path: '/domain-expert/recommendation-rules' },
          { label: 'Lịch sử', path: '/domain-expert/history' },
        ],
      },
    ],
  },
]

export default function FarmOwnerLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
