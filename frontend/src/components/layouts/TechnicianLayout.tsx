import AppShell from '@/components/layouts/AppShell';
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar';
import { IconAlert, IconDevice, IconFarm, IconSettings } from '@/components/ui/icons';

// Khung Farm Technician trên web (Report 4 §5.4, todo-ui-layout §3.3):
// Cảnh báo đứng đầu (MF-02), thiết bị, nhà được giao; Cài đặt tạm giữ lại tới khi SH-02/SH-03 hoàn tất trên mobile.
const menuSections: MenuSection[] = [
  {
    title: 'Vận hành',
    items: [
      { label: 'Cảnh báo', path: '/alerts', icon: IconAlert },
      { label: 'Thiết bị & Cảm biến', path: '/devices', icon: IconDevice },
      { label: 'Nhà được giao', path: '/farms', icon: IconFarm },
    ],
  },
  {
    title: 'Khác',
    items: [{ label: 'Cài đặt', path: '/settings', icon: IconSettings }],
  },
];

export default function TechnicianLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />;
}
