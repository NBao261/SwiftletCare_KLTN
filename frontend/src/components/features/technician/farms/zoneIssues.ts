import { METRIC_BY_KEY } from '@/components/features/farm-owner/farms/farmStructure.constants'
import type { ZoneNode } from '@/components/features/farm-owner/farms/farmStructure'

type Translate = (key: string, params?: Record<string, string | number>) => string
type Format = (value: number, decimals?: number) => string

// Việc cần xử lý của một Zone, ngắn gọn để đọc một dòng: số đo vượt ngưỡng, loại cảnh báo đang mở, thiết bị mất kết nối
export function zoneIssues(zone: Pick<ZoneNode, 'breaches' | 'alerts' | 'counts'>, t: Translate, num: Format): string[] {
  const issues = zone.breaches.map(breach => {
    const metric = METRIC_BY_KEY[breach.metric]
    const label = t(breach.direction === 'high' ? 'zone.over' : 'zone.under', { metric: t(metric.labelKey) })
    return `${label} (${num(breach.value, metric.decimals)} ${metric.unit})`
  })
  // Mỗi loại cảnh báo một lần, dù mở nhiều cái
  const alertTypes = [...new Set(zone.alerts.map(alert => alert.type))]
  issues.push(...alertTypes.map(type => t(`alert.${type}`)))
  if (zone.counts.offline > 0) issues.push(t('tech.zoneOffline', { n: zone.counts.offline }))
  return issues
}
