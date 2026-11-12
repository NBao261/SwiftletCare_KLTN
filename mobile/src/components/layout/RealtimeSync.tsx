import { useAllAlertRooms } from '@/hooks/alert/useAllAlertRooms'
import { useBellRealtime } from '@/hooks/notification/useBellRealtime'
import { usePushNotificationOpen } from '@/hooks/notification/usePushNotificationOpen'
import { usePushTokenStatus } from '@/hooks/notification/usePushTokenStatus'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'

// Đăng ký FCM token sau khi đăng nhập — chỉ người nhận push mới gắn (chuyên gia không nhận push, ALERT-FR-005)
function PushTokenSync(): null {
  usePushTokenStatus()
  return null
}

// Realtime cho cả phiên đăng nhập, không vẽ gì: vào phòng mọi nhà / tầng, nghe thông báo, cảnh báo mới, lần socket nối lại;
// đăng ký push của máy và mở đúng màn khi bấm thông báo đẩy. Chỉ gắn khi đã đăng nhập (tải nhà, tầng cần token) và theo key
// là id người dùng, nên đổi tài khoản là bắt đầu lại từ đầu
export function RealtimeSync() {
  const user = useAuthStore(state => state.user)
  useAllAlertRooms()
  useBellRealtime()
  usePushNotificationOpen()
  return canPerform(user, 'editNotificationSettings') ? <PushTokenSync /> : null
}
