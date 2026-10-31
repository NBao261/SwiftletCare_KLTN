import type { PendingHealthDay } from '@/types'
import { t } from '@/utils/i18n.utils'

export interface PendingTasksSummary {
  total: number
  summary: string
}

// Tổng số việc và câu tóm tắt theo từng loại: "2 nhà chờ đánh giá ngày · 1 cảnh báo chờ phán quyết"
export function summarizePendingTasks(pendingDays: PendingHealthDay[], pendingVerdictCount: number): PendingTasksSummary {
  const houseCount = new Set(pendingDays.map(day => day.house_id)).size
  const parts = [
    houseCount > 0 ? t('{count} nhà chờ đánh giá ngày', { count: houseCount }) : null,
    pendingVerdictCount > 0 ? t('{count} cảnh báo chờ phán quyết', { count: pendingVerdictCount }) : null,
  ]
  return {
    // Đếm theo từng việc (cặp nhà + ngày), không theo số loại việc
    total: pendingDays.length + pendingVerdictCount,
    summary: parts.filter(Boolean).join(' · '),
  }
}
