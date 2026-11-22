import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { expertRemindersApi, type ExpertReminderKind } from '@/apis/shared/expertReminders.api'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { HEALTH_REPORTS_KEY } from '@/hooks/shared/useHealthDays'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'

// Danh sách chứa `expert_reminded_at` của từng loại việc, đọc lại sau khi nhắc hoặc khi backend báo việc đã đổi
const REMINDER_QUERY_KEYS: Record<ExpertReminderKind, readonly unknown[]> = {
  alert: ['expert', 'inferred-alerts'],
  health_report: [HEALTH_REPORTS_KEY],
  harvest_cycle: ['harvest', 'cycles'],
}

// nút "Nhắc chuyên gia": đã nhắc theo bản ghi, hoặc vừa nhắc đúng việc này (ngăn kéo dùng lại cho việc khác)
export function useRemindExpert(kind: ExpertReminderKind, id: string | undefined, remindedAt: string | null | undefined) {
  const [remindedId, setRemindedId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const refresh = () => queryClient.invalidateQueries({ queryKey: REMINDER_QUERY_KEYS[kind] })
  const mutation = useMutation({
    mutationFn: (taskId: string) => expertRemindersApi.remind(kind, taskId),
    onSuccess: (_result, taskId) => {
      setRemindedId(taskId)
      push(t('Đã nhắc chuyên gia.'))
      void refresh()
    },
    // 409 có thể là đã nhắc, việc đã xong hoặc chưa tới lúc: đọc lại bản ghi để biết, không tự coi là đã nhắc
    onError: error => {
      push(apiErrorMessage(error), 'error')
      void refresh()
    },
  })
  return {
    reminded: Boolean(remindedAt) || (id !== undefined && remindedId === id),
    remind: () => id && mutation.mutate(id),
    isPending: mutation.isPending,
  }
}
