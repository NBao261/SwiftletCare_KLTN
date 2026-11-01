import { StyleSheet, View } from 'react-native'
import { StatRow } from '@/components/analytics/StatRow'
import { ChartFrame } from '@/components/charts/ChartFrame'
import { MetricLineChart } from '@/components/charts/MetricLineChart'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useAlertEvidence } from '@/hooks/alert/useAlertEvidence'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Alert, TelemetryRecord, Zone } from '@/types'
import { getAxisBounds } from '@/utils/analytics.utils'
import { formatVietnamTime } from '@/utils/date.utils'
import { getAlertTypeLabel, getMetricLabel, getMetricUnit } from '@/utils/label.utils'
import { formatPercentValue } from '@/utils/number.utils'
import { METRIC_DECIMALS } from '@/utils/sensorTile.utils'
import type { SensorMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

// Biểu đồ nhỏ xếp dọc trong chi tiết
const MINI_CHART_HEIGHT = 110
const EVIDENCE_METRICS: SensorMetric[] = ['temperature', 'humidity', 'nh3', 'co2', 'sound']

// Trường của bản ghi số đo ứng với từng chỉ số
function readMetric(record: TelemetryRecord, metric: SensorMetric): number | null {
  const values: Record<SensorMetric, number | undefined> = {
    temperature: record.temperature,
    humidity: record.humidity,
    light: record.light_lux,
    nh3: record.nh3_ppm,
    co2: record.co2_ppm,
    sound: record.sound_db,
  }
  const value = values[metric]
  return typeof value === 'number' ? value : null
}

interface AlertEvidenceProps {
  alert: Alert
  houseId: string | null
  houseZones: Zone[]
  enabled: boolean
  now: number
}

// Bằng chứng của cảnh báo suy luận (ALERT-FR-014, BR-23), ghép từ API sẵn có: các chỉ số của tầng và số chim 5 phút
// của nhà ±30 phút quanh lúc cảnh báo (vạch cam tại lúc cảnh báo), cảnh báo thiết bị đang mở của tầng;
// tỉ lệ về tổ giảm thì xem cả ngày của từng tầng. Nguồn không có số thì ghi "Thiếu dữ liệu", không vẽ về 0
export function AlertEvidence({ alert, houseId, houseZones, enabled, now }: AlertEvidenceProps) {
  const palette = usePalette()
  const evidence = useAlertEvidence({ alert, houseId, houseZones, enabled, now })
  const markerTime = evidence.window.at

  if (alert.type === 'LOW_RETURN_RATE') {
    const { rows, isLoading, isError } = evidence.daily
    return (
      <View style={styles.section}>
        <Text variant="body" weight="semiBold">
          {t('Bằng chứng trong ngày của phiên')}
        </Text>
        {isLoading ? (
          <Text variant="small" color={palette.textSecondary}>
            {t('Đang tải')}
          </Text>
        ) : isError || rows.length === 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            {t('Thiếu dữ liệu')}
          </Text>
        ) : (
          rows.map(({ zone, metrics }) => {
            const alertEntries = Object.entries(metrics.alerts_by_type).filter(([, count]) => (count ?? 0) > 0)
            return (
              <View key={zone._id} style={styles.zoneBlock}>
                <Text variant="small" weight="semiBold">
                  {zone.name}
                </Text>
                <StatRow
                  label={t('Độ ẩm trong ngưỡng')}
                  value={
                    metrics.humidity_in_range_pct === null
                      ? t('Thiếu dữ liệu')
                      : formatPercentValue(metrics.humidity_in_range_pct)
                  }
                />
                <StatRow
                  label={t('Nhiệt độ trong ngưỡng')}
                  value={
                    metrics.temp_in_range_pct === null
                      ? t('Thiếu dữ liệu')
                      : formatPercentValue(metrics.temp_in_range_pct)
                  }
                />
                {alertEntries.map(([type, count]) => (
                  <StatRow
                    key={type}
                    label={getAlertTypeLabel(type as Alert['type'])}
                    value={t('{count} lần', { count: count ?? 0 })}
                    isWarning
                  />
                ))}
              </View>
            )
          })
        )}
      </View>
    )
  }

  const records = evidence.telemetry.data ?? []
  const times = records.map(record => record.timestamp)
  const buckets = evidence.buckets.data ?? []
  const deviceAlerts = (evidence.deviceAlerts.data ?? []).filter(item => item._id !== alert._id)

  return (
    <View style={styles.section}>
      <Text variant="body" weight="semiBold">
        {t('Bằng chứng ±30 phút quanh lúc cảnh báo')}
      </Text>
      {EVIDENCE_METRICS.map(metric => {
        const values = records.map(record => readMetric(record, metric))
        const hasData = values.some(value => value !== null)
        return (
          <ChartFrame
            key={metric}
            title={getMetricLabel(metric)}
            summary={t('{metric} quanh lúc cảnh báo', { metric: getMetricLabel(metric) })}
            height={MINI_CHART_HEIGHT}
            isLoading={evidence.telemetry.isLoading}
            isError={evidence.telemetry.isError}
            isEmpty={!hasData}
            emptyMessage={t('Thiếu dữ liệu')}
            onRetry={() => evidence.telemetry.refetch()}
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
                markerTime={markerTime}
              />
            )}
          </ChartFrame>
        )
      })}
      <ChartFrame
        title={t('Chim ra / về 5 phút của nhà')}
        summary={t('Chim ra, chim về 5 phút quanh lúc cảnh báo')}
        height={MINI_CHART_HEIGHT}
        isLoading={evidence.buckets.isLoading}
        isError={evidence.buckets.isError}
        isEmpty={buckets.length === 0}
        emptyMessage={t('Thiếu dữ liệu (camera không gửi số đếm trong khoảng này)')}
        onRetry={() => evidence.buckets.refetch()}
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
            markerTime={markerTime}
            fillArea={false}
          />
        )}
      </ChartFrame>
      <View style={styles.zoneBlock}>
        <Text variant="small" weight="semiBold">
          {t('Cảnh báo thiết bị đang mở của tầng')}
        </Text>
        {evidence.deviceAlerts.isLoading ? (
          <Text variant="small" color={palette.textSecondary}>
            {t('Đang tải')}
          </Text>
        ) : deviceAlerts.length === 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            {t('Không có cảnh báo thiết bị nào đang mở')}
          </Text>
        ) : (
          deviceAlerts.map(item => (
            <StatRow
              key={item._id}
              label={getAlertTypeLabel(item.type)}
              value={formatVietnamTime(item.created_at)}
              isWarning
            />
          ))
        )}
      </View>
      <Text variant="small" color={palette.textSecondary}>
        {t('Ghép từ số đo, số đếm chim và cảnh báo của hệ thống; vạch cam là lúc cảnh báo.')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  zoneBlock: { gap: Spacing.xs },
})
