import type { AppColors } from '@/constants/theme'
import type { AlertSeverity } from '@/types'
import { t } from '@/utils/i18n.utils'

// 4 cấp mức độ hiển thị, cùng web (frontend/src/constants/severity.ts, G-32 Q-07): P1 Khẩn cấp, P2 Cao, P3 Trung bình, P4 Thấp
export type SeverityLevel = 'P1' | 'P2' | 'P3' | 'P4'

// Mỗi mức backend là một cấp: CRITICAL tới cả chủ trại ngay và vượt giờ yên lặng, HIGH tới kỹ thuật viên trước (BR-15)
const SEVERITY_TO_LEVEL: Record<AlertSeverity, SeverityLevel> = {
  CRITICAL: 'P1',
  HIGH: 'P2',
  MEDIUM: 'P3',
  LOW: 'P4',
}

const LEVEL_LABELS: Record<SeverityLevel, string> = {
  P1: 'Khẩn cấp',
  P2: 'Cao',
  P3: 'Trung bình',
  P4: 'Thấp',
}

// Thứ tự 4 cấp từ nặng đến nhẹ (dải tóm tắt, bộ lọc của tab Cảnh báo, kênh theo mức)
export const SEVERITY_LEVELS: readonly SeverityLevel[] = ['P1', 'P2', 'P3', 'P4']

// Đọc giá trị lọc cấp từ tham số route hoặc bộ lọc đã nhớ: nhận 'P1'..'P4' và cả 4 mức của backend; lạ thì null
export function parseSeverityLevel(value: string | null | undefined): SeverityLevel | null {
  if (!value) return null
  const level = SEVERITY_LEVELS.find(item => item === value)
  if (level) return level
  return value in SEVERITY_TO_LEVEL ? SEVERITY_TO_LEVEL[value as AlertSeverity] : null
}

// Cấp hiển thị của một mức cảnh báo
export function getSeverityLevel(severity: AlertSeverity): SeverityLevel {
  return SEVERITY_TO_LEVEL[severity]
}

// Mức backend của từng cấp hiển thị (tham số severity của GET /alerts, by_severity của kênh thông báo)
const LEVEL_TO_SEVERITY: Record<SeverityLevel, AlertSeverity> = {
  P1: 'CRITICAL',
  P2: 'HIGH',
  P3: 'MEDIUM',
  P4: 'LOW',
}

// Mức backend của một cấp hiển thị
export function getLevelSeverity(level: SeverityLevel): AlertSeverity {
  return LEVEL_TO_SEVERITY[level]
}

// Nhãn tiếng Việt của cấp hiển thị
export function getSeverityLevelLabel(level: SeverityLevel): string {
  return t(LEVEL_LABELS[level])
}

// Màu nền + chữ badge của cấp, cùng web: đỏ, cam đặc, cam nhạt, xám (token trong theme)
export function getSeverityLevelColors(level: SeverityLevel, palette: AppColors['light']) {
  const colors = {
    P1: { background: palette.severityCritical, text: palette.severityCriticalText },
    P2: { background: palette.severityP1, text: palette.severityP1Text },
    P3: { background: palette.severityP2, text: palette.severityP2Text },
    P4: { background: palette.severityP3, text: palette.severityP3Text },
  }
  return colors[level]
}
