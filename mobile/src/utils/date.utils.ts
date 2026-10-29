import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

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
  return formatDistanceToNow(parseISO(isoDate), { addSuffix: true, locale: vi })
}
