import { ClipboardList, ShieldCheck, SlidersHorizontal, FileText, History } from 'lucide-react';
import AppShell from '@/components/layouts/AppShell';
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar';
import { IconSettings } from '@/components/ui/icons';
import { BasketIcon, BirdIcon, ChartBarIcon, CpuIcon, HouseIcon, SquaresFourIcon } from '@phosphor-icons/react';

/**
 * Layout cho vai trò Chuyên gia nuôi yến (DOMAIN_EXPERT) — FE_Design §12.5.
 *
 * Triết lý "Decision-first":
 *   Chuyên gia đăng nhập → thấy ngay HÀI ĐỢI VIỆC (queue), không phải dashboard số liệu.
 *   Dữ liệu vận hành (dashboard, analytics, camera, thu hoạch) Chuyên gia đọc qua trang
 *   Farm Owner ở chế độ chỉ đọc — không nhân bản giao diện.
 *
 * Nhóm "Chuyên môn" chỉ chứa các màn quyết định độc quyền của Chuyên gia:
 *   /domain-expert/queue          ← Trang chủ: việc cần xử lý
 *   /domain-expert/alert-verdicts ← Thẩm định cảnh báo AI
 *   /domain-expert/tuning         ← Ngưỡng & Hệ số mờ
 *   /domain-expert/reports        ← Báo cáo & Kết luận
 *   /domain-expert/history        ← Lịch sử hoạt động
 *
 * Nhóm "Vận hành (chỉ đọc)" trỏ thẳng tới trang Farm Owner (Report 3 §2.4, G-15 ma trận quyền);
 * nút ghi trên các trang đó gate bằng usePermission('FARM_OWNER'). Dock mobile vẫn là 4 màn quyết định đầu.
 *
 * Bucket: components/layouts/ — theo §12.5.
 */
const menuSections: MenuSection[] = [
  {
    title: 'Chuyên môn',
    items: [
      { label: 'Hàng đợi việc', path: '/domain-expert/queue', icon: ClipboardList },
      { label: 'Thẩm định Cảnh báo', path: '/domain-expert/alert-verdicts', icon: ShieldCheck },
      { label: 'Ngưỡng & Hệ số mờ', path: '/domain-expert/tuning', icon: SlidersHorizontal },
      { label: 'Báo cáo & Kết luận', path: '/domain-expert/reports', icon: FileText },
      { label: 'Lịch sử hoạt động', path: '/domain-expert/history', icon: History },
    ],
  },
  {
    title: 'Vận hành (chỉ đọc)',
    items: [
      { label: 'Tổng quan nhà yến', path: '/dashboard', icon: SquaresFourIcon },
      { label: 'Giám sát đàn chim', path: '/vision', icon: BirdIcon },
      { label: 'Phân tích', path: '/analytics', icon: ChartBarIcon },
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: CpuIcon },
      { label: 'Trang trại', path: '/farms', icon: HouseIcon },
      { label: 'Thống kê sản lượng', path: '/harvests', icon: BasketIcon },
    ],
  },
  {
    title: 'Khác',
    items: [{ label: 'Cài đặt', path: '/settings', icon: IconSettings }],
  },
];

export default function DomainExpertLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />;
}
