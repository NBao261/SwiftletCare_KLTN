import type { AppColors } from '@/constants/theme'
import type { AlertSeverity } from '@/types'
import { t } from '@/utils/i18n.utils'

// 3 cấp mức độ hiển thị, cùng web (frontend/src/constants/severity.ts): P1 Khẩn cấp, P2 Cao, P3 Thường
export type SeverityLevel = 'P1' | 'P2' | 'P3'

// Backend gửi 4 mức, giao diện gộp CRITICAL và HIGH vào P1 như web
const SEVERITY_TO_LEVEL: Record<AlertSeverity, SeverityLevel> = {
  CRITICAL: 'P1',
  HIGH: 'P1',
  MEDIUM: 'P2',
  LOW: 'P3',
}

const LEVEL_LABELS: Record<SeverityLevel, string> = {
  P1: 'Khẩn cấp',
  P2: 'Cao',
  P3: 'Thường',
}

// Cấp hiển thị của một mức cảnh báo
export function getSeverityLevel(severity: AlertSeverity): SeverityLevel {
  return SEVERITY_TO_LEVEL[severity]
}

// Nhãn tiếng Việt của cấp hiển thị
export function getSeverityLevelLabel(level: SeverityLevel): string {
  return t(LEVEL_LABELS[level])
}

// Màu nền + chữ badge của cấp, lấy từ token severityP1..P3 trong theme (cùng web)
export function getSeverityLevelColors(level: SeverityLevel, palette: AppColors['light']) {
  const colors = {
    P1: { background: palette.severityP1, text: palette.severityP1Text },
    P2: { background: palette.severityP2, text: palette.severityP2Text },
    P3: { background: palette.severityP3, text: palette.severityP3Text },
  }
  return colors[level]
}
