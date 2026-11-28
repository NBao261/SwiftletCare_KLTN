import { create } from 'zustand'

export interface ToastItem { id: number; message: string; tone: 'success' | 'error' }

interface ToastState {
  toasts: ToastItem[]
  push: (message: string, tone?: ToastItem['tone']) => void
  dismiss: (id: number) => void
}

let nextId = 1

// Lỗi ở lâu hơn thành công: câu lỗi dài hơn và người dùng cần đọc kịp để biết làm gì tiếp
export const TOAST_DURATION_MS: Record<ToastItem['tone'], number> = { success: 4000, error: 8000 }

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'success') => {
    // Cùng câu cùng tone đang hiện thì không chồng thêm (bấm lưu hai lần trong vài giây chỉ hiện một lần)
    if (get().toasts.some(toast => toast.message === message && toast.tone === tone)) return
    const id = nextId++
    set(s => ({ toasts: [...s.toasts, { id, message, tone }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), TOAST_DURATION_MS[tone])
  },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
