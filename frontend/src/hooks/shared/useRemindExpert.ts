import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { expertRemindersApi, type ExpertReminderKind } from '@/apis/shared/expertReminders.api'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'

// BR-22 — nút "Nhắc chuyên gia": đã nhắc (từ bản ghi hoặc vừa bấm) thì nút thành dòng chữ; nhắc trùng (409) cũng coi là đã nhắc
export function useRemindExpert(kind: ExpertReminderKind, id: string | undefined, remindedAt: string | null | undefined) {
  const [justReminded, setJustReminded] = useState(false)
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const mutation = useMutation({
    mutationFn: () => expertRemindersApi.remind(kind, id!),
    onSuccess: () => {
      setJustReminded(true)
      push(t('Đã nhắc chuyên gia.'))
    },
    onError: error => {
      if ((error as { response?: { status?: number } }).response?.status === 409) setJustReminded(true)
      push(apiErrorMessage(error), 'error')
    },
  })
  return { reminded: Boolean(remindedAt) || justReminded, remind: () => mutation.mutate(), isPending: mutation.isPending }
}
