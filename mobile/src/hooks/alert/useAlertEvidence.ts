import { useQueries, useQuery } from '@tanstack/react-query'
import { alertApi } from '@/services/api/alert.api'
import { analyticsApi } from '@/services/api/analytics.api'
import { healthReportApi } from '@/services/api/healthReport.api'
import { telemetryApi } from '@/services/api/telemetry.api'
import type { Alert, Zone } from '@/types'
import { DEVICE_ALERT_TYPES } from '@/utils/alertList.utils'

// Cửa sổ bằng chứng quanh lúc cảnh báo (ALERT-FR-014)
const EVIDENCE_WINDOW_MS = 30 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
// Mẫu số đo mỗi 10 giây, một tầng có thể có vài controller: 1000 là mức tối đa của API, đủ cho 60 phút
const TELEMETRY_LIMIT = 1000

interface EvidenceScope {
  alert: Alert | null
  // Nhà của cảnh báo (cảnh báo tầng không mang house_id) và các tầng của nhà đó
  houseId: string | null
  houseZones: Zone[]
  // Chỉ tải sau khi sheet mở xong để mở không bị chậm
  enabled: boolean
  // Bây giờ (useNow): cảnh báo mới tạo thì cửa sổ chỉ tới hiện tại
  now: number
}

// Bằng chứng của cảnh báo suy luận, ghép từ API sẵn có vì backend chưa có API bằng chứng riêng (ALERT-FR-014):
// số đo của tầng và số chim 5 phút của nhà ±30 phút quanh lúc cảnh báo, cảnh báo thiết bị đang mở của tầng;
// tỉ lệ về tổ giảm: báo cáo xem trước cả ngày của từng tầng (% trong ngưỡng, cảnh báo theo loại)
export function useAlertEvidence({ alert, houseId, houseZones, enabled, now }: EvidenceScope) {
  const createdAt = alert ? Date.parse(alert.created_at) : 0
  const from = new Date(createdAt - EVIDENCE_WINDOW_MS).toISOString()
  const to = new Date(Math.min(createdAt + EVIDENCE_WINDOW_MS, now)).toISOString()
  const zoneId = alert?.zone_id ?? ''
  const isDaily = alert?.type === 'LOW_RETURN_RATE'
  const sessionDate = typeof alert?.metadata?.sessionDate === 'string' ? alert.metadata.sessionDate : null

  const telemetryQuery = useQuery({
    queryKey: ['telemetry', 'evidence', zoneId, from, to],
    queryFn: () =>
      telemetryApi
        .getHistory(zoneId, from, to, TELEMETRY_LIMIT)
        .then(response =>
          [...response.data.data].sort((first, second) => first.timestamp.localeCompare(second.timestamp)),
        ),
    enabled: enabled && !isDaily && Boolean(zoneId),
  })

  const bucketsQuery = useQuery({
    queryKey: ['analytics', 'evidence-buckets', houseId, from, to],
    queryFn: () =>
      analyticsApi.getBirdCountBuckets(houseId as string, from, to).then(response => response.data.data.buckets),
    enabled: enabled && !isDaily && Boolean(houseId),
  })

  const deviceAlertsQuery = useQuery({
    queryKey: ['alerts', 'evidence-devices', zoneId],
    queryFn: () =>
      alertApi
        .list({ zoneId, status: 'ACTIVE', limit: '100' })
        .then(response => response.data.data.filter(item => DEVICE_ALERT_TYPES.includes(item.type))),
    enabled: enabled && !isDaily && Boolean(zoneId),
  })

  // Cả ngày của phiên (giờ Việt Nam); backend kẹp to về bây giờ nếu ngày chưa hết
  const dayStart = sessionDate ? Date.parse(`${sessionDate}T00:00:00+07:00`) : 0
  const dailyPreviews = useQueries({
    queries: houseZones.map(zone => ({
      queryKey: ['health-reports', 'evidence', zone._id, sessionDate],
      queryFn: () =>
        healthReportApi
          .preview(
            zone._id,
            new Date(dayStart).toISOString(),
            new Date(Math.min(dayStart + DAY_MS, Date.now())).toISOString(),
          )
          .then(response => ({ zone, metrics: response.data.data.metrics })),
      enabled: enabled && isDaily && Boolean(sessionDate),
    })),
  })

  return {
    window: { from, to, at: alert?.created_at ?? '' },
    telemetry: telemetryQuery,
    buckets: bucketsQuery,
    deviceAlerts: deviceAlertsQuery,
    daily: {
      rows: dailyPreviews.flatMap(result => (result.data ? [result.data] : [])),
      isLoading: dailyPreviews.some(result => result.isLoading),
      isError: dailyPreviews.some(result => result.isError),
    },
  }
}
