import { create } from 'zustand'

export interface Crumb {
  label: string
  /** Không gắn cho phần tử cuối (vị trí hiện tại) — AppHeader tự hiển thị mờ, không cho bấm. */
  onClick?: () => void
}

export interface BackLink {
  to: string
  label: string
}

interface BreadcrumbState {
  trail: Crumb[]
  /** Nút "← Quay lại" phía trên khung trắng nội dung, do trang tự đăng ký qua `usePageBack` — null thì AppShell không render */
  back: BackLink | null
  setTrail: (trail: Crumb[]) => void
  setBack: (back: BackLink | null) => void
}

/**
 * Đuôi breadcrumb do từng trang tự đăng ký qua `usePageBreadcrumb` (xem
 * hooks/useBreadcrumb.ts) — AppHeader luôn tự thêm tên trang hiện
 * tại (tra trong menu của role đang đăng nhập) làm cấp gốc đứng trước, nối thêm đuôi này.
 * Trang không gọi hook thì đuôi rỗng, AppHeader chỉ hiện mỗi tên trang.
 */
export const useBreadcrumbStore = create<BreadcrumbState>(set => ({
  trail: [],
  back: null,
  setTrail: trail => set({ trail }),
  setBack: back => set({ back }),
}))
