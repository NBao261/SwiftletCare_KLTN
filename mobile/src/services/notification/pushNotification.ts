import * as Notifications from 'expo-notifications'
import { AndroidImportance } from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { Colors } from '@/constants/theme'
import type { PushTokenPayload } from '@/services/api/pushToken.api'

// Thông báo đến khi app đang mở vẫn hiện banner, vào trung tâm thông báo và phát âm thanh
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// Máy này nhận push được không:
// - ready: có token FCM để gửi backend
// - no-permission: người dùng chưa cho phép (chỉ xin quyền khi họ bấm bật, không tự hỏi)
// - unsupported: máy ảo, iOS (backend chỉ nhận token FCM, iOS cần cấu hình APNs qua Firebase — chưa có), hoặc bản app chưa có
//   Firebase (Expo Go, bản build thiếu google-services.json)
export type DevicePushState =
  | { kind: 'ready'; payload: PushTokenPayload }
  | { kind: 'no-permission' }
  | { kind: 'unsupported' }

// Kênh Android cho cảnh báo: ưu tiên cao nhất, đèn màu cảnh báo
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('alerts', {
    name: 'Alert Notifications',
    importance: AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: Colors.raw.safetyOrange,
  })
}

// Xin quyền thông báo — chỉ gọi khi người dùng bấm bật nhận push (mobile/CLAUDE.md, quy tắc push)
export async function requestPushPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  const requested = await Notifications.requestPermissionsAsync()
  return requested.granted
}

// FCM device token của máy, KHÔNG hỏi quyền (ALERT-FR-002): chưa có quyền thì no-permission. Không ghi log token
export async function getDevicePushState(): Promise<DevicePushState> {
  if (!Device.isDevice || Platform.OS !== 'android') return { kind: 'unsupported' }
  const permission = await Notifications.getPermissionsAsync()
  if (!permission.granted) return { kind: 'no-permission' }
  try {
    await ensureAndroidChannel()
    const devicePushToken = await Notifications.getDevicePushTokenAsync()
    if (typeof devicePushToken.data !== 'string' || devicePushToken.data === '') return { kind: 'unsupported' }
    return { kind: 'ready', payload: { token: devicePushToken.data, platform: 'android' } }
  } catch {
    // Bản app chưa có Firebase không lấy được token FCM
    return { kind: 'unsupported' }
  }
}
