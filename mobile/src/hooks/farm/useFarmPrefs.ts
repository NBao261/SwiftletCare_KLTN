import { useAuthStore } from '@/stores/authStore'
import { EMPTY_FARM_PREFS, useFarmPrefsStore, type FarmPrefs } from '@/stores/farmPrefsStore'

// Lựa chọn ở tab Farm của tài khoản đang đăng nhập (lưu trên máy); chưa đăng nhập thì userId rỗng
export function useFarmPrefs(): { userId: string; prefs: Readonly<FarmPrefs> } {
  const userId = useAuthStore(state => state.user?._id ?? '')
  const prefs = useFarmPrefsStore(state => state.byUserId[userId] ?? EMPTY_FARM_PREFS)
  return { userId, prefs }
}
