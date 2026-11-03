import { t } from '@/i18n'
import { alertBreach, formatSensor } from '@/lib/helpers'
import { formatDateTime } from '@/lib/i18n'
import type { Alert } from '@/types'

// Tên chỉ số theo từ điển chung (src/i18n/en.ts); NH3, CO2 giữ nguyên
const METRIC_LABEL: Record<string, string> = {
  temperature: 'Nhiệt độ',
  humidity: 'Độ ẩm',
  light_lux: 'Ánh sáng',
  nh3_ppm: 'NH3',
  co2_ppm: 'CO2',
}

// Số đo: số nguyên giữ nguyên, số lẻ 1 chữ số (FE_Design 6.1)
const formatMeasure = (value: number, unit: string): string =>
  formatSensor(value, unit, Number.isInteger(value) ? 0 : 1)

/**
 * Dòng chi tiết của 1 cảnh báo — dùng chung cho Farm Owner và Technician (trang /alerts):
 * vượt ngưỡng (G-05, ALERT-FR-012): chỉ số, giá trị đo, ngưỡng, hướng, vượt liên tục từ lúc nào;
 * khởi động lại bất thường (THREAT-FR-012): lý do. Cảnh báo không có chi tiết thì không hiện gì.
 */
export default function AlertDetailsLine({ alert }: { alert: Alert }) {
  const breach = alertBreach(alert)
  const resetReason = alert.details?.reset_reason

  if (!breach && !resetReason) return null

  return (
    <p className="text-sm text-charcoal">
      {breach && (
        <>
          <span className="font-semibold">
            {t(breach.direction === 'below' ? '{{metric}} {{value}} · dưới ngưỡng {{limit}}' : '{{metric}} {{value}} · vượt ngưỡng trên {{limit}}', {
              metric: t(METRIC_LABEL[breach.metric] ?? breach.metric),
              value: formatMeasure(breach.value, breach.unit),
              limit: formatMeasure(breach.limit, breach.unit),
            })}
          </span>
          {breach.startedAt && (
            <span className="text-warmGray"> · {t('liên tục từ {{time}}', { time: formatDateTime(breach.startedAt) })}</span>
          )}
        </>
      )}
      {resetReason && <span className="font-semibold">{t('Lý do khởi động lại: {{reason}}', { reason: resetReason })}</span>}
    </p>
  )
}
