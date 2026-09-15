import { NavLink } from 'react-router-dom'
import { cn } from '@/utils/cn'

// SRS: UX-NFR-001 – responsive sidebar. Style: FE_Design_Swiftlet.md §3.C
// (Nền Sidebar Charcoal + accent Lime Mist)
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Tổng quan' },
  { to: '/farms',     label: 'Trang trại' },
  { to: '/devices',   label: 'Thiết bị' },
  { to: '/alerts',    label: 'Cảnh báo' },
  { to: '/analytics', label: 'Phân tích' },
  { to: '/tickets',   label: 'Ticket' },
  { to: '/harvests',  label: 'Thu hoạch' },
  { to: '/settings',  label: 'Cài đặt' },
]

export default function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col bg-charcoal">
      <div className="flex h-16 items-center px-6">
        <span className="text-lg font-bold tracking-tight text-white">SwiftletCare</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-limeMist text-charcoal font-bold' : 'text-white/70 hover:bg-white/10 hover:text-white',
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
