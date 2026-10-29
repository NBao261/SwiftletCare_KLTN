import { ClipboardList, ShieldCheck, SlidersHorizontal, FileText, History } from 'lucide-react';
import AppShell from '@/components/layouts/AppShell';
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar';
import { IconSettings } from '@/components/ui/icons';

/**
 * Layout cho vai trò Chuyên gia nuôi yến (DOMAIN_EXPERT) — FE_Design §12.5.
 *
 * Triết lý "Decision-first":
 *   Chuyên gia đăng nhập → thấy ngay HÀI ĐỢI VIỆC (queue), không phải dashboard số liệu.
 *   Dữ liệu vận hành (dashboard, analytics, camera, thu hoạch) Chuyên gia đọc qua trang
 *   Farm Owner ở chế độ chỉ đọc — không nhân bản giao diện.
 *
 * Menu chỉ chứa các màn quyết định độc quyền của Chuyên gia:
 *   /domain-expert/queue          ← Trang chủ: việc cần xử lý
 *   /domain-expert/alert-verdicts ← Thẩm định cảnh báo AI
 *   /domain-expert/tuning         ← Ngưỡng & Hệ số mờ
 *   /domain-expert/reports        ← Báo cáo & Kết luận
 *   /domain-expert/history        ← Lịch sử hoạt động
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
    title: 'Khác',
    items: [{ label: 'Cài đặt', path: '/settings', icon: IconSettings }],
  },
];

export default function DomainExpertLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />;
}
