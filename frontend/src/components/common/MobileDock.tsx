import { NavLink } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { getDockItems } from '@/constants/navigation'
import { useAuthStore } from '@/store/authStore'

/**
 * Bottom Floating Dock cho mobile/tablet — khung `rounded-full` nền trắng,
 * shadow dock, nút tròn bên trong (màu theo FE_Design_Claude.md §2).
 *
 * Trước đây sidebar `w-64` cố định chiếm gần hết màn hình điện thoại khiến app
 * gần như không dùng được ở 375px (UX-NFR-001 yêu cầu hỗ trợ ≥375px).
 */
export default function MobileDock() {
  const role = useAuthStore(s => s.user?.role)
  const items = getDockItems(role)

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="flex items-center gap-1 rounded-full border border-warmGray/15 bg-white p-2 shadow-dock">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            aria-label={item.label}
            className={({ isActive }) =>
              cn(
                'flex h-12 items-center gap-2 rounded-full px-3.5 transition-colors',
                isActive ? 'bg-charcoal text-white' : 'text-warmGray hover:bg-warmGray/10',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon width={20} height={20} className="shrink-0" />
                {/* Chỉ mục đang mở mới hiện nhãn — dock gọn, vẫn biết mình đang ở đâu */}
                {isActive && <span className="text-sm font-semibold">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
