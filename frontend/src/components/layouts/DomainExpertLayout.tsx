import {
  BasketIcon, BirdIcon, ChartBarIcon,
  ClipboardTextIcon, ClockCounterClockwiseIcon, CpuIcon, CrosshairIcon, FileTextIcon,
  HeartbeatIcon, HouseIcon, LightbulbFilamentIcon, ShieldCheckIcon, SlidersHorizontalIcon, SquaresFourIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import AppShell from '@/components/layouts/AppShell';
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar';

// Khung Domain Expert (FE_Design §12.5): Chuyên môn là màn quyết định, Vận hành trỏ tới trang Farm Owner chỉ đọc (Report 4 §5.4)
// Menu: §3.2 todo-ui-layout-1120.md — 7 mục Chuyên môn (2 nhóm tab), 8 mục Vận hành thu gọn
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
          { label: 'Bù thời tiết', path: '/domain-expert/weather-rules' },
        ],
      },
      {
        label: 'Đếm chim',
        path: '/domain-expert/counting-schedule',
        icon: CrosshairIcon,
        tabs: [
          { label: 'Lịch đếm', path: '/domain-expert/counting-schedule' },
          { label: 'Vòng đếm', path: '/domain-expert/counting-ring' },
        ],
      },
      { label: 'Luật khuyến nghị', path: '/domain-expert/recommendation-rules', icon: LightbulbFilamentIcon },
      { label: 'Báo cáo & kết luận', path: '/domain-expert/reports', icon: FileTextIcon },
      { label: 'Lịch sử quyết định', path: '/domain-expert/history', icon: ClockCounterClockwiseIcon },
    ],
  },
  {
    title: 'Vận hành (chỉ đọc)',
    collapsible: true,
    // Tab như menu Farm Owner (§3.1), bỏ tab "Điều khiển tay" (§3.2): chuyên gia đọc so sánh nhà, góp ý kế hoạch bảo trì, đọc khuyến nghị (Report 3 §2.4)
    items: [
      {
        label: 'Tổng quan',
        path: '/dashboard',
        icon: SquaresFourIcon,
        tabs: [
          { label: 'Tình trạng các nhà', path: '/dashboard' },
          { label: 'So sánh nhà', path: '/overview' },
        ],
      },
      { label: 'Đàn chim', path: '/vision', icon: BirdIcon },
      { label: 'Sức khoẻ', path: '/health', icon: HeartbeatIcon },
      { label: 'Phân tích', path: '/analytics', icon: ChartBarIcon },
      { label: 'Thiết bị', path: '/devices', icon: CpuIcon },
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
      { label: 'Trang trại', path: '/farms', icon: HouseIcon },
      { label: 'Thu hoạch', path: '/harvests', icon: BasketIcon },
    ],
  },
];

export default function DomainExpertLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />;
}
