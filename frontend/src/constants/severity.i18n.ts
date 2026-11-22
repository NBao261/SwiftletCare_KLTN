import type { Dictionary } from '@/lib/i18n';
import type { AlertSeverity, SeverityLevel } from '@/types';
import { SEVERITY_TO_LEVEL } from '@/constants/severity';

// Nhãn VI/EN của 4 cấp mức độ (BR-15)
const vi: Record<SeverityLevel, string> = {
  P1: 'Khẩn cấp',
  P2: 'Cao',
  P3: 'Trung bình',
  P4: 'Thấp',
};

const en: Record<SeverityLevel, string> = {
  P1: 'Critical',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
};

export const levelDict: Dictionary<SeverityLevel> = { vi, en };

// Nhãn theo mã mức backend, mỗi mức một cấp — cho từ điển màn đang tra theo mã backend
export function severityLabels(labels: Record<SeverityLevel, string>): Record<AlertSeverity, string> {
  return {
    CRITICAL: labels[SEVERITY_TO_LEVEL.CRITICAL],
    HIGH: labels[SEVERITY_TO_LEVEL.HIGH],
    MEDIUM: labels[SEVERITY_TO_LEVEL.MEDIUM],
    LOW: labels[SEVERITY_TO_LEVEL.LOW],
  };
}
