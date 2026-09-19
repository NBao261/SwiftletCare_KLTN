import { create } from 'zustand'

export interface Crumb {
  label: string
  /** Không gắn cho phần tử cuối (vị trí hiện tại) — TopBar tự hiển thị mờ, không cho bấm. */
  onClick?: () => void
}

interface BreadcrumbState {
  trail: Crumb[]
  setTrail: (trail: Crumb[]) => void
}

/**
 * Đuôi breadcrumb do từng trang tự đăng ký qua `usePageBreadcrumb` (xem
 * hooks/useBreadcrumb.ts) — TopBar (SideBar.tsx) luôn tự thêm tên trang hiện
 * tại (từ constants/navigation.ts) làm cấp gốc đứng trước, nối thêm đuôi này.
 * Trang không gọi hook thì đuôi rỗng, TopBar chỉ hiện mỗi tên trang.
 */
export const useBreadcrumbStore = create<BreadcrumbState>(set => ({
  trail: [],
  setTrail: trail => set({ trail }),
}))
