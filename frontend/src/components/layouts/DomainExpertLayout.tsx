import {
  BasketIcon, BirdIcon, BooksIcon, BuildingsIcon, CalendarBlankIcon, CalendarCheckIcon, ChartBarIcon, ChecksIcon,
  ClipboardTextIcon, ClockCounterClockwiseIcon, CloudRainIcon, CpuIcon, CrosshairIcon, FileTextIcon,
  HeartbeatIcon, HouseIcon, LightbulbFilamentIcon, LightbulbIcon, ShieldCheckIcon, SlidersHorizontalIcon, SquaresFourIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import AppShell from '@/components/layouts/AppShell';
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar';

// Khung Domain Expert (FE_Design §12.5): Chuyên môn là màn quyết định, Vận hành trỏ tới trang Farm Owner chỉ đọc (Report 4 §5.4); cùng tên, icon với menu Farm Owner
const menuSections: MenuSection[] = [
  {
    title: 'Chuyên môn',
    items: [
      { label: 'Hàng đợi việc', path: '/domain-expert/queue', icon: ClipboardTextIcon },
      { label: 'Kiểm chứng cảnh báo', path: '/domain-expert/alert-verdicts', icon: ShieldCheckIcon },
      { label: 'Ngưỡng & hệ số mờ', path: '/domain-expert/tuning', icon: SlidersHorizontalIcon },
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
      { label: 'Tổng quan trang trại', path: '/overview', icon: BuildingsIcon },
      { label: 'Thống kê sản lượng', path: '/harvests', icon: BasketIcon },
      { label: 'Lịch bảo trì', path: '/maintenance', icon: CalendarCheckIcon },
    ],
  },
];

export default function DomainExpertLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />;
}
