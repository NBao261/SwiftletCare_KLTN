import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationChannelApi } from '@/services/api/notificationChannel.api'
import type { AlertType, NotificationChannelSetting } from '@/types'

interface UpdateChannelInput {
  type: AlertType
  setting: NotificationChannelSetting
}

// Lưu kênh nhận của một loại cảnh báo (ALERT-FR-005) — đang là dữ liệu mẫu
export function useUpdateNotificationChannel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ type, setting }: UpdateChannelInput) => notificationChannelApi.update(type, setting),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-channels'] }),
  })
}
