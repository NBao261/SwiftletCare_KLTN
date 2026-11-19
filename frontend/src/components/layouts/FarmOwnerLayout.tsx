import {
  BasketIcon, BirdIcon, BooksIcon, BuildingsIcon, CalendarBlankIcon, CalendarCheckIcon, ChartBarIcon, ChecksIcon,
  ClockCounterClockwiseIcon, CloudRainIcon, CpuIcon, CrosshairIcon, GearSixIcon, HeartbeatIcon, HouseIcon,
  LightbulbFilamentIcon, LightbulbIcon, ShieldCheckIcon, SlidersHorizontalIcon, SquaresFourIcon, WarningIcon, WrenchIcon,
} from '@phosphor-icons/react'
import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'

// Khung Farm Owner: Vận hành là việc hằng ngày (4 mục đầu là dock mobile, Cảnh báo thứ hai); báo cáo và ngày lệch ở Sức khỏe nhà yến
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      { label: 'Tổng quan', path: '/dashboard', icon: SquaresFourIcon },
      { label: 'Cảnh báo', path: '/alerts', icon: WarningIcon },
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: CpuIcon },
      { label: 'Giám sát đàn chim', path: '/vision', icon: BirdIcon },
      { label: 'Sức khoẻ nhà yến', path: '/health', icon: HeartbeatIcon },
      { label: 'Phân tích', path: '/analytics', icon: ChartBarIcon },
      { label: 'Phiếu công việc', path: '/work-orders', icon: WrenchIcon },
      { label: 'Khuyến nghị', path: '/recommendations', icon: LightbulbIcon },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { label: 'Trang trại', path: '/farms', icon: HouseIcon },
      { label: 'Tổng quan trang trại', path: '/overview', icon: BuildingsIcon },
      { label: 'Thống kê sản lượng', path: '/harvests', icon: BasketIcon },
      { label: 'Lịch bảo trì', path: '/maintenance', icon: CalendarCheckIcon },
    ],
  },
  {
    // Trang quyết định của chuyên gia (Report 4 §5.4): farm chưa có chuyên gia thì Farm Owner quyết định thay (BR-22),
    // farm đã có thì xem; lịch sử quyết định của chuyên gia (EXPERT-FR-009)
    title: 'Chuyên môn',
    items: [
      { label: 'Kiểm chứng cảnh báo', path: '/domain-expert/alert-verdicts', icon: ShieldCheckIcon },
      { label: 'Ngưỡng & hệ số mờ', path: '/domain-expert/tuning', icon: SlidersHorizontalIcon },
      { label: 'Lịch đếm chim', path: '/domain-expert/counting-schedule', icon: CalendarBlankIcon },
      { label: 'Vòng đếm camera', path: '/domain-expert/counting-ring', icon: CrosshairIcon },
      { label: 'Luật bù thời tiết', path: '/domain-expert/weather-rules', icon: CloudRainIcon },
      { label: 'Duyệt & đề xuất', path: '/domain-expert/reviews', icon: ChecksIcon },
      { label: 'Hồ sơ cấu hình', path: '/domain-expert/profiles', icon: BooksIcon },
      { label: 'Luật khuyến nghị', path: '/domain-expert/recommendation-rules', icon: LightbulbFilamentIcon },
      { label: 'Lịch sử quyết định', path: '/domain-expert/history', icon: ClockCounterClockwiseIcon },
    ],
  },
  {
    title: 'Khác',
    items: [{ label: 'Cài đặt', path: '/settings', icon: GearSixIcon }],
  },
]

export default function FarmOwnerLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
