import * as Notifications from 'expo-notifications'
import { AndroidImportance } from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { Colors } from '@/constants/theme'

// Thông báo đến khi app đang mở vẫn hiện banner, vào trung tâm thông báo và phát âm thanh
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// Xin quyền và lấy push token (ALERT-FR-002) — chưa làm: gửi token lên backend (chờ endpoint trong api-spec.yaml)
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    return null
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId: projectId ?? '' })

  // Kênh Android cho cảnh báo: ưu tiên cao nhất, đèn màu cảnh báo
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'Alert Notifications',
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: Colors.raw.safetyOrange,
    })
  }

  return pushToken.data
}
