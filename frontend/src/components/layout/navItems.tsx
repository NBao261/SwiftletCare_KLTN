import type { ComponentType, SVGProps } from 'react'
import {
  IconDashboard, IconFarm, IconDevice, IconAlert,
  IconAnalytics, IconTicket, IconHarvest, IconSettings,
} from '@/components/ui/icons'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

/**
 * Danh sách điều hướng dùng chung cho Sidebar (desktop) và MobileDock (mobile),
 * để 2 nơi không bị lệch nhau khi thêm/bớt màn hình.
 */
export const NAV_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Vận hành',
    items: [
      { to: '/dashboard', label: 'Tổng quan', icon: IconDashboard },
      { to: '/devices',   label: 'Thiết bị',  icon: IconDevice },
      { to: '/alerts',    label: 'Cảnh báo',  icon: IconAlert },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { to: '/farms',     label: 'Trang trại', icon: IconFarm },
      { to: '/tickets',   label: 'Ticket',     icon: IconTicket },
      { to: '/harvests',  label: 'Thu hoạch',  icon: IconHarvest },
    ],
  },
  {
    title: 'Khác',
    items: [
      { to: '/analytics', label: 'Phân tích', icon: IconAnalytics },
      { to: '/settings',  label: 'Cài đặt',   icon: IconSettings },
    ],
  },
]

/** 4 mục chính hiển thị trên dock mobile — chọn theo tần suất dùng hằng ngày */
export const DOCK_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Tổng quan', icon: IconDashboard },
  { to: '/devices',   label: 'Thiết bị',  icon: IconDevice },
  { to: '/alerts',    label: 'Cảnh báo',  icon: IconAlert },
  { to: '/farms',     label: 'Trang trại', icon: IconFarm },
]
