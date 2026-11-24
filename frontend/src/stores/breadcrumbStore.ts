import { create } from 'zustand'

export interface Crumb {
  label: string
  // Không gắn cho phần tử cuối (vị trí hiện tại): AppHeader tự hiển thị mờ, không cho bấm.
  onClick?: () => void
}

export interface BackLink {
  to: string
  label: string
  // State gắn vào lượt chuyển trang (VD báo trang cha biết là đi lên)
  state?: unknown
}

interface BreadcrumbState {
  trail: Crumb[]
  // null thì AppShell không render
  back: BackLink | null
  // State gắn khi bấm cấp gốc của breadcrumb (tên trang)
  rootState?: unknown
  setTrail: (trail: Crumb[], rootState?: unknown) => void
  setBack: (back: BackLink | null) => void
}

// AppHeader tự thêm tên trang làm cấp gốc rồi nối đuôi này
export const useBreadcrumbStore = create<BreadcrumbState>(set => ({
  trail: [],
  back: null,
  setTrail: (trail, rootState) => set({ trail, rootState }),
  setBack: back => set({ back }),
}))
