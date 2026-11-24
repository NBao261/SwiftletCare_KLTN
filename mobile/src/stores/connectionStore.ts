import { create } from 'zustand'

interface ConnectionState {
  // Request gần nhất không nhận được phản hồi nào từ máy chủ (sai địa chỉ, máy chủ tắt, quá thời gian chờ) — dùng cả khi chưa
  // đăng nhập (chưa có socket), ví dụ bấm Đăng nhập lúc backend tắt
  isServerUnreachable: boolean
  setServerUnreachable: (isUnreachable: boolean) => void
}

// Trạng thái máy chủ theo kết quả request HTTP: apiClient ghi, banner kết nối đọc (useConnectionStatus)
export const useConnectionStore = create<ConnectionState>(set => ({
  isServerUnreachable: false,
  setServerUnreachable: isUnreachable => set({ isServerUnreachable: isUnreachable }),
}))
