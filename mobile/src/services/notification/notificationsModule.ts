import { isRunningInExpoGo } from 'expo'

type NotificationsModule = typeof import('expo-notifications')

// Expo Go (SDK 53+) thiếu module native push mà expo-notifications nạp ngay khi import, nên không nạp để app vẫn mở được
export const notificationsModule: NotificationsModule | null = isRunningInExpoGo()
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports -- import tĩnh sẽ nạp module native ngay cả trong Expo Go
    (require('expo-notifications') as NotificationsModule)
