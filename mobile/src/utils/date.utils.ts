import { format, formatDistanceToNow, getISOWeek, parseISO } from 'date-fns'
import { enUS, vi } from 'date-fns/locale'
import { getCurrentLanguage, t } from '@/utils/i18n.utils'

// Ngày giờ dạng DD/MM/YYYY HH:mm
export function formatDateTime(isoDate: string): string {
  return format(parseISO(isoDate), 'dd/MM/yyyy HH:mm', { locale: vi })
}

// Ngày dạng DD/MM/YYYY
export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), 'dd/MM/yyyy', { locale: vi })
}

// Khoảng thời gian tới hiện tại ("2 phút trước")
export function formatTimeAgo(isoDate: string): string {
  return formatDistanceToNow(parseISO(isoDate), { addSuffix: true, locale: getCurrentLanguage() === 'en' ? enUS : vi })
}

// Ngày và tháng dạng DD/MM
export function formatDayMonth(date: Date): string {
  return format(date, 'dd/MM', { locale: vi })
}

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000

// Ngày hôm nay theo giờ Việt Nam, dạng dd/MM — không phụ thuộc múi giờ của máy
export function formatVietnamDayMonth(time: number = Date.now()): string {
  return formatDayMonth(parseISO(getVietnamDate(time)))
}

// Ngày theo giờ Việt Nam của một thời điểm (mặc định bây giờ), dạng YYYY-MM-DD — không phụ thuộc múi giờ của máy
export function getVietnamDate(time: number = Date.now()): string {
  return new Date(time + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)
}

// Số tuần ISO theo ngày giờ Việt Nam của một thời điểm: báo cáo 19–25/10/2026 là tuần 43
export function getIsoWeekNumber(isoDate: string): number {
  return getISOWeek(parseISO(getVietnamDate(Date.parse(isoDate))))
}

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// Khoảng thời gian đã kéo dài, chỉ lấy đơn vị lớn nhất: "25 giây", "14 phút", "2 giờ", "1 ngày"
export function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < MINUTE_MS) return t('{count} giây', { count: Math.max(0, Math.floor(elapsedMs / SECOND_MS)) })
  if (elapsedMs < HOUR_MS) return t('{count} phút', { count: Math.floor(elapsedMs / MINUTE_MS) })
  if (elapsedMs < DAY_MS) return t('{count} giờ', { count: Math.floor(elapsedMs / HOUR_MS) })
  return t('{count} ngày', { count: Math.floor(elapsedMs / DAY_MS) })
}
