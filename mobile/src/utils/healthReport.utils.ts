import type { HouseHealthReportKind, HouseHealthReportSummary } from '@/types'
import { getIsoWeekNumber } from '@/utils/date.utils'
import { formatHealthDate } from '@/utils/healthDay.utils'
import { t } from '@/utils/i18n.utils'

// Báo cáo theo yêu cầu dài tối đa 31 ngày (api-spec POST /health-reports)
export const CUSTOM_REPORT_MAX_DAYS = 31
const DAY_MS = 24 * 60 * 60 * 1000

// 4 loại kỳ báo cáo theo thứ tự chip (BR-33; CUSTOM do người dùng tạo)
export const REPORT_KINDS: readonly HouseHealthReportKind[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']

const KIND_LABELS: Record<HouseHealthReportKind, string> = {
  DAILY: 'Ngày',
  WEEKLY: 'Tuần',
  MONTHLY: 'Tháng',
  CUSTOM: 'Theo yêu cầu',
}

export function getReportKindLabel(kind: HouseHealthReportKind): string {
  return t(KIND_LABELS[kind])
}

// Tên kỳ của báo cáo: "05/11", "Tuần 45 · 02/11 – 08/11", "Tháng 10/2026", "01/11 – 10/11"
export function formatReportPeriod(report: Pick<HouseHealthReportSummary, 'kind' | 'period_start' | 'period_end'>): string {
  const range = `${formatHealthDate(report.period_start)} – ${formatHealthDate(report.period_end)}`
  if (report.kind === 'DAILY') return formatHealthDate(report.period_start)
  if (report.kind === 'WEEKLY') return `${t('Tuần {week}', { week: getIsoWeekNumber(report.period_start) })} · ${range}`
  if (report.kind === 'MONTHLY') {
    const [year, month] = report.period_start.split('-')
    return t('Tháng {month}/{year}', { month, year })
  }
  return range
}

// Số ngày của khoảng from…to (YYYY-MM-DD), tính cả hai đầu
export function countDaysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
}

// Kiểm khoảng báo cáo theo yêu cầu trước khi gửi, như backend (400): câu lỗi, hoặc null khi hợp lệ
export function validateCustomReportRange(from: string, to: string, today: string): string | null {
  if (to > today) return t('Ngày cuối không được sau hôm nay')
  if (from > to) return t('Ngày đầu phải trước hoặc bằng ngày cuối')
  if (countDaysInclusive(from, to) > CUSTOM_REPORT_MAX_DAYS) {
    return t('Báo cáo dài tối đa {days} ngày', { days: CUSTOM_REPORT_MAX_DAYS })
  }
  return null
}
