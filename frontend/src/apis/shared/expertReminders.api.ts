import api from '@/lib/axios'
import type { ApiResponse } from '@/types'

// BR-22 (Report 3 4.2.15) — việc chỉ chuyên gia làm mà Farm Owner nhắc được, mỗi việc một lần
export type ExpertReminderKind = 'alert' | 'health_report' | 'harvest_cycle'

export const expertRemindersApi = {
  remind: (kind: ExpertReminderKind, id: string) =>
    api.post<ApiResponse<{ kind: ExpertReminderKind; id: string; expert_reminded_at: string }>>('/expert-activity/reminders', { kind, id }),
}
