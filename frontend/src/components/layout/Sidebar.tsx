import { NavLink } from 'react-router-dom'
// SRS: UX-NFR-001 – responsive sidebar

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard',  icon: '📊' },
  { to: '/farms',     label: 'Trang trại', icon: '🏠' },
  { to: '/devices',   label: 'Thiết bị',   icon: '📡' },
  { to: '/alerts',    label: 'Cảnh báo',   icon: '🔔' },
  { to: '/analytics', label: 'Phân tích',  icon: '📈' },
  { to: '/settings',  label: 'Cài đặt',    icon: '⚙️' },
]

export default function Sidebar() {
  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <span className="text-teal-400 font-bold text-lg tracking-tight">🐦 SwiftletCare</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-teal-600/20 text-teal-300 border border-teal-600/30'
                 : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
