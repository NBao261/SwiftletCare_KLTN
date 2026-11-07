import { StyleSheet, View } from 'react-native'
import { StatRow } from '@/components/analytics/StatRow'
import { ChartFrame } from '@/components/charts/ChartFrame'
import { MetricLineChart } from '@/components/charts/MetricLineChart'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useAlertEvidence } from '@/hooks/alert/useAlertEvidence'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Alert, AlertEvidence as AlertEvidenceData, EvidenceTelemetrySample } from '@/types'
import { getAxisBounds } from '@/utils/analytics.utils'
import { formatDateTime, formatVietnamTime } from '@/utils/date.utils'
import { getAlertTypeLabel, getMetricLabel, getMetricUnit } from '@/utils/label.utils'
import { formatPercentValue } from '@/utils/number.utils'
import { METRIC_DECIMALS } from '@/utils/sensorTile.utils'
import type { SensorMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

// Biểu đồ nhỏ xếp dọc trong chi tiết
const MINI_CHART_HEIGHT = 110
const EVIDENCE_SKELETON_HEIGHT = 160
// Chỉ số có trong mẫu bằng chứng (api-spec AlertEvidence.telemetry — không có ánh sáng)
const EVIDENCE_METRICS: Exclude<SensorMetric, 'light'>[] = ['temperature', 'humidity', 'nh3', 'co2', 'sound']

// Trường của mẫu bằng chứng ứng với từng chỉ số; thiếu thì null (không vẽ về 0)
function readMetric(sample: EvidenceTelemetrySample, metric: Exclude<SensorMetric, 'light'>): number | null {
  const values: Record<Exclude<SensorMetric, 'light'>, number | null | undefined> = {
    temperature: sample.temperature,
    humidity: sample.humidity,
    nh3: sample.nh3_ppm,
    co2: sample.co2_ppm,
    sound: sample.sound_db,
  }
  const value = values[metric]
  return typeof value === 'number' ? value : null
}

// Một danh sách cảnh báo ngắn: loại + giờ (hoặc kết luận); rỗng thì một câu
function AlertList({ title, alerts, emptyText, showVerdict = false }: {
  title: string
  alerts: Alert[]
  emptyText: string
  showVerdict?: boolean
}) {
  const palette = usePalette()
  return (
    <View style={styles.block}>
      <Text variant="small" weight="semiBold">
        {title}
      </Text>
      {alerts.length === 0 ? (
        <Text variant="small" color={palette.textSecondary}>
          {emptyText}
        </Text>
      ) : (
        alerts.map(item => (
          <StatRow
            key={item._id}
            label={`${getAlertTypeLabel(item.type)} · ${formatDateTime(item.created_at)}`}
            value={
              showVerdict && item.expert_verdict
                ? item.expert_verdict.result === 'CONFIRMED'
                  ? t('Đúng')
                  : t('Bác bỏ')
                : formatVietnamTime(item.created_at)
            }
            isWarning={!showVerdict}
          />
        ))
      )}
    </View>
  )
}

interface AlertEvidenceProps {
  alert: Alert
  // Chỉ tải sau khi sheet mở xong
  enabled: boolean
}

// Bằng chứng của cảnh báo suy luận (ALERT-FR-014, BR-23) do backend tổng hợp: các chỉ số của khu vực và số chim 5 phút
// của nhà ±30 phút quanh lúc cảnh báo (vạch cam tại lúc cảnh báo), cảnh báo thiết bị đang mở của khu vực; tỉ lệ về tổ giảm
// thì % trong ngưỡng từng khu vực, tiếng ồn lạ và cảnh báo thiết bị trong ngày của phiên. Nguồn "missing" ghi
// "Thiếu dữ liệu", không vẽ về 0. Hệ thống chỉ trình bày, không tự kết luận
export function AlertEvidence({ alert, enabled }: AlertEvidenceProps) {
  const palette = usePalette()
  const evidenceQuery = useAlertEvidence(alert._id, enabled)
  const evidence: AlertEvidenceData | undefined = evidenceQuery.data

  if (evidenceQuery.isLoading || (!evidence && !evidenceQuery.isError)) {
    return <Skeleton width="100%" height={EVIDENCE_SKELETON_HEIGHT} />
  }
  if (!evidence) {
    return (
      <Text variant="small" color={palette.textSecondary} onPress={() => evidenceQuery.refetch()}>
        {t('Không tải được bằng chứng. Chạm để thử lại')}
      </Text>
    )
  }

  const earlierVerdicts = (
    <AlertList
      title={t('Kết luận trước đây cùng loại')}
      alerts={evidence.earlier_verdicts}
      emptyText={t('Chưa có cảnh báo cùng loại nào được kết luận')}
      showVerdict
    />
  )

  if (alert.type === 'LOW_RETURN_RATE') {
    const zones = evidence.zones_in_range ?? []
    return (
      <View style={styles.section}>
        <Text variant="body" weight="semiBold">
          {t('Bằng chứng trong ngày của phiên')}
        </Text>
        {zones.length === 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            {t('Thiếu dữ liệu')}
          </Text>
        ) : (
          zones.map(zone => (
            <View key={zone.zone_id} style={styles.block}>
              <Text variant="small" weight="semiBold">
                {zone.name}
              </Text>
              <StatRow
                label={t('Độ ẩm trong ngưỡng')}
                value={
                  zone.status === 'missing' || zone.humidity_in_range_pct === null
                    ? t('Thiếu dữ liệu')
                    : formatPercentValue(zone.humidity_in_range_pct)
                }
              />
              <StatRow
                label={t('Nhiệt độ trong ngưỡng')}
                value={
                  zone.status === 'missing' || zone.temp_in_range_pct === null
                    ? t('Thiếu dữ liệu')
                    : formatPercentValue(zone.temp_in_range_pct)
                }
              />
            </View>
          ))
        )}
        <AlertList
          title={t('Tiếng ồn lạ của nhà trong ngày')}
          alerts={evidence.noise_alerts ?? []}
          emptyText={t('Không có tiếng ồn lạ trong ngày')}
        />
        <AlertList
          title={t('Cảnh báo thiết bị của nhà trong ngày')}
          alerts={evidence.device_alerts}
          emptyText={t('Không có cảnh báo thiết bị trong ngày')}
        />
        {earlierVerdicts}
      </View>
    )
  }

  const telemetry = evidence.telemetry
  const samples = telemetry?.status === 'ok' ? telemetry.samples : []
  const times = samples.map(sample => sample.timestamp)
  const birdCounts = evidence.bird_counts
  const buckets = birdCounts?.status === 'ok' ? birdCounts.buckets : []
  const deviceAlerts = evidence.device_alerts.filter(item => item._id !== alert._id)

  return (
    <View style={styles.section}>
      <Text variant="body" weight="semiBold">
        {t('Bằng chứng ±30 phút quanh lúc cảnh báo')}
      </Text>
      {EVIDENCE_METRICS.map(metric => {
        const values = samples.map(sample => readMetric(sample, metric))
        return (
          <ChartFrame
            key={metric}
            title={getMetricLabel(metric)}
            summary={t('{metric} quanh lúc cảnh báo', { metric: getMetricLabel(metric) })}
            height={MINI_CHART_HEIGHT}
            isLoading={false}
            isError={false}
            isEmpty={!values.some(value => value !== null)}
            emptyMessage={t('Thiếu dữ liệu')}
            onRetry={() => evidenceQuery.refetch()}
          >
            {width => (
              <MetricLineChart
                width={width}
                height={MINI_CHART_HEIGHT}
                times={times}
                formatTime={formatVietnamTime}
                series={[{ key: metric, label: getMetricLabel(metric), color: palette.houseHealthy, values }]}
                axis={getAxisBounds(values, [])}
                decimals={METRIC_DECIMALS[metric]}
                unit={getMetricUnit(metric)}
                markerTime={alert.created_at}
              />
            )}
          </ChartFrame>
        )
      })}
      <ChartFrame
        title={t('Chim ra / về 5 phút của nhà')}
        summary={t('Chim ra, chim về 5 phút quanh lúc cảnh báo')}
        height={MINI_CHART_HEIGHT}
        isLoading={false}
        isError={false}
        isEmpty={buckets.length === 0}
        emptyMessage={t('Thiếu dữ liệu (camera không gửi số đếm trong khoảng này)')}
        onRetry={() => evidenceQuery.refetch()}
        legend={[
          { label: t('Ra'), color: palette.houseHealthy },
          { label: t('Về'), color: palette.text },
        ]}
      >
        {width => (
          <MetricLineChart
            width={width}
            height={MINI_CHART_HEIGHT}
            times={buckets.map(bucket => bucket.bucket_start)}
            formatTime={formatVietnamTime}
            series={[
              {
                key: 'exit',
                label: t('Ra'),
                color: palette.houseHealthy,
                values: buckets.map(bucket => bucket.exit_count),
              },
              { key: 'entry', label: t('Về'), color: palette.text, values: buckets.map(bucket => bucket.entry_count) },
            ]}
            axis={{
              base: 0,
              top: getAxisBounds(
                buckets.flatMap(bucket => [bucket.exit_count, bucket.entry_count]),
                [0],
              ).top,
            }}
            decimals={0}
            unit=""
            markerTime={alert.created_at}
            fillArea={false}
          />
        )}
      </ChartFrame>
      <AlertList
        title={t('Cảnh báo thiết bị đang mở của khu vực')}
        alerts={deviceAlerts}
        emptyText={t('Không có cảnh báo thiết bị nào đang mở')}
      />
      {earlierVerdicts}
      <Text variant="small" color={palette.textSecondary}>
        {t('Số đo, số đếm chim và cảnh báo do hệ thống ghi lại; vạch cam là lúc cảnh báo.')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  block: { gap: Spacing.xs },
})
