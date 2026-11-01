import { useState } from 'react'
import { StyleSheet, Switch, View } from 'react-native'
import { ArrowsOutIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { CHART_HEIGHT, ChartFrame, type ChartLegendItem } from '@/components/charts/ChartFrame'
import { ChartFullscreenModal } from '@/components/charts/ChartFullscreenModal'
import { MetricLineChart, type LineSeries } from '@/components/charts/MetricLineChart'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import type { AnalyticsScope } from '@/hooks/analytics/useAnalyticsScope'
import { useEnvSummaries } from '@/hooks/analytics/useEnvSummaries'
import { useForecast } from '@/hooks/analytics/useForecast'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AnalyticsRange } from '@/types'
import { buildEnvLine, getAxisBounds, getThresholdBounds, summarizeValues } from '@/utils/analytics.utils'
import { formatVietnamDayMonthOf, formatVietnamTime } from '@/utils/date.utils'
import { getMetricLabel, getMetricUnit } from '@/utils/label.utils'
import { formatDecimal } from '@/utils/number.utils'
import { METRIC_DECIMALS } from '@/utils/sensorTile.utils'
import type { SensorMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

const METRICS: SensorMetric[] = ['temperature', 'humidity', 'light', 'nh3', 'co2', 'sound']
// env/compare nhận tối đa 6 tầng; so sánh cũng giữ giới hạn đó
const MAX_COMPARE_ZONES = 6
// Dự báo chỉ cho nhiệt, ẩm ở khoảng 1 giờ, 6 giờ (ANALYTICS-FR-009)
const FORECAST_METRICS: readonly SensorMetric[] = ['temperature', 'humidity']
const FORECAST_RANGES: readonly AnalyticsRange[] = ['1h', '6h']

interface EnvironmentTabProps {
  scope: AnalyticsScope
}

// Giờ cho khoảng ngắn, ngày cho khoảng dài; theo giờ Việt Nam
function getTimeFormatter(range: AnalyticsRange): (isoDate: string) => string {
  return range === '7d' || range === '30d' ? formatVietnamDayMonthOf : formatVietnamTime
}

// Tab Môi trường (theo tầng, đặc tả §5): một chỉ số theo thời gian với hai vạch ngưỡng, điểm ngoài ngưỡng tô cam;
// so sánh nhiều tầng; dự báo 60 phút cho nhiệt, ẩm
export function EnvironmentTab({ scope }: EnvironmentTabProps) {
  const palette = usePalette()
  const [hiddenZoneIds, setHiddenZoneIds] = useState<ReadonlySet<string>>(new Set())
  const [isFullscreen, setFullscreen] = useState(false)
  const metric = scope.metric
  const range = scope.storedRange
  const canCompare = scope.zones.length > 1
  const isCompare = canCompare && scope.compareZones
  const zones = isCompare ? scope.zones.slice(0, MAX_COMPARE_ZONES) : scope.focusZone ? [scope.focusZone] : []
  const zoneIds = zones.map(zone => zone._id)
  const summaries = useEnvSummaries(zoneIds, range, true)
  const focusZone = scope.focusZone
  const canForecast = !isCompare && FORECAST_METRICS.includes(metric) && FORECAST_RANGES.includes(range)
  const forecastQuery = useForecast(focusZone?._id ?? '', canForecast)
  const forecast = canForecast
    ? metric === 'temperature'
      ? forecastQuery.data?.temperature
      : forecastQuery.data?.humidity
    : null
  const unit = getMetricUnit(metric)
  const decimals = METRIC_DECIMALS[metric]
  const bounds = !isCompare && focusZone ? getThresholdBounds(metric, focusZone.thresholds) : {}
  const formatTime = getTimeFormatter(range)
  const seriesColors = [palette.houseHealthy, palette.text, palette.textSecondary]

  // Trục thời gian chung: mọi mốc của các tầng, rồi các mốc dự báo phía sau
  const lines = zones.map(zone => {
    const points = buildEnvLine(summaries.seriesByZone.get(zone._id) ?? [], metric, isCompare ? {} : bounds)
    return { zone, byTime: new Map(points.map(point => [point.timestamp, point])) }
  })
  const historyTimes = [...new Set(lines.flatMap(line => [...line.byTime.keys()]))].sort()
  const forecastPoints = forecast
    ? forecast.forecast.filter(point => point.timestamp > (historyTimes.at(-1) ?? ''))
    : []
  const times = [...historyTimes, ...forecastPoints.map(point => point.timestamp)]
  const round = (value: number) => Math.round(value * 10 ** decimals) / 10 ** decimals

  const series: LineSeries[] = lines
    .filter(line => !hiddenZoneIds.has(line.zone._id))
    .map((line, index) => ({
      key: line.zone._id,
      label: line.zone.name,
      color: seriesColors[index % seriesColors.length],
      // Tầng thứ 4 trở đi dùng lại màu với nét đứt để vẫn phân biệt được
      isDashed: index >= seriesColors.length,
      values: times.map(time => line.byTime.get(time)?.value ?? null),
      outOfRange: isCompare ? undefined : times.map(time => line.byTime.get(time)?.isOutOfRange ?? false),
    }))
  if (forecastPoints.length > 0 && series[0]) {
    // Nét đứt nối tiếp từ số đo cuối cùng
    const lastIndex = historyTimes.length - 1
    const lastValue = series[0].values[lastIndex]
    series.push({
      key: 'forecast',
      label: t('Dự báo'),
      color: palette.houseHealthy,
      isDashed: true,
      values: times.map((_time, index) =>
        index === lastIndex ? lastValue : index > lastIndex ? round(forecastPoints[index - lastIndex - 1].value) : null,
      ),
    })
  }

  const allValues = series.flatMap(line => line.values)
  const axis = getAxisBounds(allValues, [bounds.min, bounds.max])
  const focusSummary = summarizeValues(series[0]?.values ?? [])
  const metricLabel = getMetricLabel(metric)
  const summary = focusSummary
    ? t('{metric}: thấp nhất {min}, cao nhất {max}', {
        metric: metricLabel,
        min: `${formatDecimal(focusSummary.min, decimals)}${unit}`,
        max: `${formatDecimal(focusSummary.max, decimals)}${unit}`,
      })
    : metricLabel

  const legend: ChartLegendItem[] = isCompare
    ? lines.map((line, index) => ({
        label: line.zone.name,
        color: seriesColors[index % seriesColors.length],
        isDashed: index >= seriesColors.length,
        isHidden: hiddenZoneIds.has(line.zone._id),
        onPress: () =>
          setHiddenZoneIds(current => {
            const next = new Set(current)
            if (next.has(line.zone._id)) next.delete(line.zone._id)
            else next.add(line.zone._id)
            return next
          }),
      }))
    : [
        { label: focusZone?.name ?? metricLabel, color: palette.houseHealthy },
        { label: t('Ngoài ngưỡng'), color: palette.alert },
        ...(forecastPoints.length > 0 ? [{ label: t('Dự báo'), color: palette.houseHealthy, isDashed: true }] : []),
      ]

  const renderChart = (width: number, height: number) => (
    <MetricLineChart
      width={width}
      height={height}
      times={times}
      formatTime={formatTime}
      series={series}
      bounds={bounds}
      axis={axis}
      decimals={decimals}
      unit={unit}
    />
  )

  const toggleCompare = (isOn: boolean) => {
    // Tắt so sánh khi đang chọn "Tất cả tầng": chuyển về một tầng
    if (!isOn && scope.selectedZoneId === null && focusZone) scope.selectZone(focusZone._id)
    scope.setCompareZones(isOn)
  }

  return (
    <View style={styles.tab}>
      <Card>
        <ChoiceChips
          options={METRICS.map(item => ({ id: item, label: getMetricLabel(item) }))}
          selectedId={metric}
          onSelect={scope.selectMetric}
          placement="card"
          accessibilityLabel={t('Chọn chỉ số')}
        />
        {canCompare && (
          <View style={styles.switchRow}>
            <Text variant="body" style={styles.flex}>
              {t('So sánh tầng')}
            </Text>
            <Switch
              value={isCompare}
              onValueChange={toggleCompare}
              accessibilityLabel={t('So sánh tầng')}
              trackColor={{ false: palette.border, true: palette.inverse }}
              thumbColor={palette.surface}
            />
          </View>
        )}
        <ChartFrame
          title={isCompare ? t('{metric} các tầng', { metric: metricLabel }) : metricLabel}
          summary={summary}
          isLoading={summaries.isLoading}
          isError={summaries.isError}
          isEmpty={historyTimes.length === 0}
          isFetching={summaries.isFetching && !summaries.isLoading}
          onRetry={() => summaries.refetch()}
          emptyAction={
            range !== '30d' ? { label: t('Xem 30 ngày'), onPress: () => scope.selectRange('30d') } : undefined
          }
          legend={legend}
          headerRight={
            historyTimes.length > 0 ? (
              <IconButton icon={ArrowsOutIcon} label={t('Xem toàn màn hình')} onPress={() => setFullscreen(true)} />
            ) : undefined
          }
        >
          {width => renderChart(width, CHART_HEIGHT)}
        </ChartFrame>
        <Text variant="small" color={palette.textSecondary}>
          {t('Chạm giữ để xem giá trị và giờ. Khoảng trống là lúc không có số đo.')}
        </Text>
        {(metric === 'nh3' || metric === 'co2') && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Ngưỡng cảnh báo tạm thời, không điều khiển quạt.')}
          </Text>
        )}
        {canForecast && !forecastQuery.isLoading && (
          <Text variant="small" color={palette.textSecondary}>
            {forecast
              ? t('Dự báo 60 phút tới. Sai số trung bình: 30 phút ±{mae30}, 60 phút ±{mae60}', {
                  mae30: forecast.mae30 === null ? '_' : `${formatDecimal(forecast.mae30, 1)}${unit}`,
                  mae60: forecast.mae60 === null ? '_' : `${formatDecimal(forecast.mae60, 1)}${unit}`,
                })
              : t('Chưa đủ dữ liệu để dự báo')}
          </Text>
        )}
      </Card>

      <ChartFullscreenModal
        visible={isFullscreen}
        title={isCompare ? t('{metric} các tầng', { metric: metricLabel }) : metricLabel}
        onClose={() => setFullscreen(false)}
      >
        {(width, height) => renderChart(width, height)}
      </ChartFullscreenModal>
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: Spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
})
