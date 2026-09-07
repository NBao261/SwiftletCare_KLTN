/**
 * Utility functions for SwiftletCare Mobile
 */
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

// ── Date formatting ─────────────────────────────────────────────────────────────
export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy HH:mm', { locale: vi })
}

export function formatTimeAgo(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: vi })
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: vi })
}

// ── Number formatting ──────────────────────────────────────────────────────────
export function formatTemperature(val: number): string {
  return `${val.toFixed(1)}°C`
}

export function formatHumidity(val: number): string {
  return `${val.toFixed(1)}%`
}

export function formatPercentage(val: number, decimals = 1): string {
  return `${(val * 100).toFixed(decimals)}%`
}

// ── Severity helpers ────────────────────────────────────────────────────────────
export function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    CRITICAL: 'Nghiêm trọng',
    HIGH:     'Cao',
    MEDIUM:   'Trung bình',
    LOW:      'Thấp',
  }
  return labels[severity] ?? severity
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ONLINE:   'Trực tuyến',
    OFFLINE:  'Mất kết nối',
    ERROR:    'Lỗi',
    DEGRADED: 'Suy giảm',
  }
  return labels[status] ?? status
}

// ── Validation ──────────────────────────────────────────────────────────────────
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
}
