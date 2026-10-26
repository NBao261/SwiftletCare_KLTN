import type { Dictionary } from '@/lib/i18n';
import type { AlertSeverity, SeverityLevel } from '@/types';
import { SEVERITY_TO_LEVEL } from '@/constants/severity';

// Nhãn VI/EN của 3 cấp mức độ
const vi: Record<SeverityLevel, string> = {
  P1: 'Khẩn cấp',
  P2: 'Cao',
  P3: 'Thường',
};

const en: Record<SeverityLevel, string> = {
  P1: 'Urgent',
  P2: 'High',
  P3: 'Normal',
};

export const levelDict: Dictionary<SeverityLevel> = { vi, en };

// Nhãn theo mã mức backend (4 mức) quy về 3 cấp — cho từ điển màn đang tra theo mã backend
export function severityLabels(labels: Record<SeverityLevel, string>): Record<AlertSeverity, string> {
  return {
    CRITICAL: labels[SEVERITY_TO_LEVEL.CRITICAL],
    HIGH: labels[SEVERITY_TO_LEVEL.HIGH],
    MEDIUM: labels[SEVERITY_TO_LEVEL.MEDIUM],
    LOW: labels[SEVERITY_TO_LEVEL.LOW],
  };
}
