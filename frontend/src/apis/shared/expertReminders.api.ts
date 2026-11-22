import api from '@/lib/axios'
import type { ApiResponse } from '@/types'

// việc chỉ chuyên gia làm mà Farm Owner nhắc được, mỗi việc một lần
export type ExpertReminderKind = 'alert' | 'health_report' | 'harvest_cycle'

export const expertRemindersApi = {
  remind: (kind: ExpertReminderKind, id: string) =>
    api.post<ApiResponse<{ kind: ExpertReminderKind; id: string; expert_reminded_at: string }>>('/expert-activity/reminders', { kind, id }),
}
