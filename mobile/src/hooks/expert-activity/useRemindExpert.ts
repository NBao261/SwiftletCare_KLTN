import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { expertActivityApi } from '@/services/api/expertActivity.api'
import type { ExpertReminderKind } from '@/types'
import { getSettingsErrorMessage, readApiError } from '@/utils/apiError.utils'

// Danh sách chứa expert_reminded_at của từng loại việc, đọc lại sau khi nhắc hoặc khi backend báo việc đã đổi
const REMINDER_QUERY_KEYS: Record<ExpertReminderKind, readonly string[]> = {
  alert: ['alerts'],
  health_report: ['health-reports'],
  harvest_cycle: ['harvest-cycles'],
}

export interface RemindExpertState {
  // Đã nhắc theo bản ghi, hoặc vừa nhắc xong việc này
  reminded: boolean
  // Backend trả 409 (farm không còn chuyên gia, việc đã xong hoặc đã nhắc): ẩn nút, đọc lại bản ghi
  isHidden: boolean
  isPending: boolean
  // Câu lỗi của lần nhắc vừa hỏng (trừ 409)
  error: string | null
  remind: () => void
}

// Nút "Nhắc chuyên gia" của Farm Owner trên farm có chuyên gia (BR-22 nhóm C, POST /expert-activity/reminders): mỗi việc một lần.
// Nhớ theo id việc vì một màn có thể dùng lại cho việc khác (sheet cảnh báo mở cảnh báo khác)
export function useRemindExpert(kind: ExpertReminderKind, id: string, remindedAt: string | null | undefined): RemindExpertState {
  const queryClient = useQueryClient()
  const [remindedId, setRemindedId] = useState<string | null>(null)
  const [hiddenId, setHiddenId] = useState<string | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: REMINDER_QUERY_KEYS[kind] })

  const mutation = useMutation({
    mutationFn: (taskId: string) => expertActivityApi.remindExpert(kind, taskId).then(response => response.data.data),
    onSuccess: (_reminder, taskId) => {
      setRemindedId(taskId)
      void refresh()
    },
    onError: (error, taskId) => {
      if (readApiError(error).status === 409) setHiddenId(taskId)
      void refresh()
    },
  })
  const isConflict = readApiError(mutation.error).status === 409

  return {
    reminded: Boolean(remindedAt) || remindedId === id,
    isHidden: hiddenId === id,
    isPending: mutation.isPending,
    error: mutation.error && !isConflict && mutation.variables === id ? getSettingsErrorMessage(mutation.error) : null,
    remind: () => mutation.mutate(id),
  }
}
