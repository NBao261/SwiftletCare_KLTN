import {
  BasketIcon, BirdIcon, ChartBarIcon, CpuIcon, GearSixIcon, HouseIcon, SquaresFourIcon, TicketIcon, WarningIcon,
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
        label: 'Yêu cầu hỗ trợ',
        path: '/support',
        icon: TicketIcon
      },
      {
        label: 'Thống kê sản lượng',
        path: '/harvests',
        icon: BasketIcon
      },
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
        label: 'Thông báo',
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
