import {
  BasketIcon, BirdIcon, BooksIcon, BuildingsIcon, CalendarBlankIcon, CalendarCheckIcon, ChartBarIcon, ChecksIcon,
  ClockCounterClockwiseIcon, CloudRainIcon, CpuIcon, CrosshairIcon, FileTextIcon, GearSixIcon, HeartbeatIcon, HouseIcon,
  LightbulbFilamentIcon, LightbulbIcon, ShieldCheckIcon, SlidersHorizontalIcon, SquaresFourIcon, WarningIcon, WrenchIcon,
} from '@phosphor-icons/react'
import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'

/**
 * Khung ứng dụng cho Farm Owner — role duy nhất có Tổng quan + Phân tích (giám
 * sát môi trường chi tiết theo zone) và Thống kê sản lượng (thu hoạch).
 */
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      {
        label: 'Tổng quan',
        path: '/dashboard',
        icon: SquaresFourIcon
      },
      {
        label: 'Thiết bị & Cảm biến',
        path: '/devices',
        icon: CpuIcon
      },
      {
        label: 'Giám sát đàn chim',
        path: '/vision',
        icon: BirdIcon
      },
      {
        label: 'Phiếu công việc',
        path: '/work-orders',
        icon: WrenchIcon
      },
      {
        label: 'Khuyến nghị',
        path: '/recommendations',
        icon: LightbulbIcon
      },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      {
        label: 'Trang trại',
        path: '/farms',
        icon: HouseIcon
      },
      {
        label: 'Tổng quan trại',
        path: '/overview',
        icon: BuildingsIcon
      },
      {
        label: 'Thống kê sản lượng',
        path: '/harvests',
        icon: BasketIcon
      },
      {
        label: 'Lịch bảo trì',
        path: '/maintenance',
        icon: CalendarCheckIcon
      },
    ],
  },
  {
    // Trang quyết định của chuyên gia (Report 4 §5.4): farm chưa có chuyên gia thì Farm Owner quyết định thay (BR-22),
    // farm đã có thì xem; lịch sử quyết định của chuyên gia (EXPERT-FR-009)
    title: 'Chuyên môn',
    items: [
      { label: 'Thẩm định cảnh báo', path: '/domain-expert/alert-verdicts', icon: ShieldCheckIcon },
      { label: 'Ngưỡng & hệ số', path: '/domain-expert/tuning', icon: SlidersHorizontalIcon },
      { label: 'Lịch đếm chim', path: '/domain-expert/counting-schedule', icon: CalendarBlankIcon },
      { label: 'Vòng đếm camera', path: '/domain-expert/counting-ring', icon: CrosshairIcon },
      { label: 'Luật bù thời tiết', path: '/domain-expert/weather-rules', icon: CloudRainIcon },
      { label: 'Duyệt & đề xuất', path: '/domain-expert/reviews', icon: ChecksIcon },
      { label: 'Báo cáo & kết luận', path: '/domain-expert/reports', icon: FileTextIcon },
      { label: 'Hồ sơ cấu hình', path: '/domain-expert/profiles', icon: BooksIcon },
      { label: 'Luật khuyến nghị', path: '/domain-expert/recommendation-rules', icon: LightbulbFilamentIcon },
      { label: 'Lịch sử quyết định', path: '/domain-expert/history', icon: ClockCounterClockwiseIcon },
    ],
  },
  {
    title: 'Khác',
    items: [
      {
        label: 'Phân tích',
        path: '/analytics',
        icon: ChartBarIcon
      },
      {
        label: 'Sức khỏe nhà yến',
        path: '/health',
        icon: HeartbeatIcon
      },
      {
        label: 'Cảnh báo',
        path: '/alerts',
        icon: WarningIcon
      },
      {
        label: 'Cài đặt',
        path: '/settings',
        icon: GearSixIcon
      },
    ],
  },
]

export default function FarmOwnerLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
