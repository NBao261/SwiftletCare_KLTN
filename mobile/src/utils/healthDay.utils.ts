import type { PendingHealthDay } from '@/types'
import { getVietnamDate } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

// Report 3 SM-17: một ngày không được chấm trong 7 ngày thì hết hạn chấm
const RATING_WINDOW_DAYS = 7
// Chấm cam khi hạn chấm còn không quá 1 ngày
const DUE_SOON_DAYS = 1
const DAY_MS = 24 * 60 * 60 * 1000

export interface PendingTasksSummary {
  total: number
  summary: string
  isDueSoon: boolean
}

// Số ngày còn lại để chấm: hạn chót là 7 ngày sau ngày cần đánh giá
export function getRatingDaysLeft(date: string, now: number = Date.now()): number {
  const elapsedDays = (Date.parse(getVietnamDate(now)) - Date.parse(date)) / DAY_MS
  return RATING_WINDOW_DAYS - elapsedDays
}

// Tổng số việc và câu tóm tắt theo từng loại: "2 nhà chờ đánh giá ngày · 1 cảnh báo chờ phán quyết"
export function summarizePendingTasks(
  pendingDays: PendingHealthDay[],
  pendingVerdictCount: number,
  now: number = Date.now(),
): PendingTasksSummary {
  const houseCount = new Set(pendingDays.map(day => day.house_id)).size
  const parts = [
    houseCount > 0 ? t('{count} nhà chờ đánh giá ngày', { count: houseCount }) : null,
    pendingVerdictCount > 0 ? t('{count} cảnh báo chờ phán quyết', { count: pendingVerdictCount }) : null,
  ]
  return {
    // Đếm theo từng việc (cặp nhà + ngày), không theo số loại việc
    total: pendingDays.length + pendingVerdictCount,
    summary: parts.filter(Boolean).join(' · '),
    // Chỉ việc đánh giá ngày bật chấm cam; cảnh báo chờ phán quyết thì không
    isDueSoon: pendingDays.some(day => getRatingDaysLeft(day.date, now) <= DUE_SOON_DAYS),
  }
}
