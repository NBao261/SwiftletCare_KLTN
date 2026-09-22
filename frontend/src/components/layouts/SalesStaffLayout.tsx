import AppShell from '@/components/layouts/AppShell'
import { firstDockItems, type MenuSection } from '@/components/layouts/AppSidebar'
import { IconSettings } from '@/components/ui/icons'

/**
 * Khung ứng dụng cho Sales Staff — module Bán hàng còn là scaffold 501 bên
 * backend (Giai đoạn 2) nên chưa có màn hình nghiệp vụ nào để đưa lên nav;
 * trang nhà /sales-home là stub và cố ý không nằm trong sidebar.
 */
const menuSections: MenuSection[] = [
  {
    title: 'Khác',
    items: [{ label: 'Cài đặt', path: '/settings', icon: IconSettings }],
  },
]

export default function SalesStaffLayout() {
  return <AppShell menuSections={menuSections} dockItems={firstDockItems(menuSections)} />
}
