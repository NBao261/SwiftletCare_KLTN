import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Card } from '@/components/ui/card'
import { OverrideHistoryCard } from '@/components/analytics/OverrideHistoryCard'
import { StatRow } from '@/components/analytics/StatRow'
import { SuggestionCard } from '@/components/analytics/SuggestionCard'
import { CHART_HEIGHT, ChartFrame } from '@/components/charts/ChartFrame'
import { ControlChart } from '@/components/charts/ControlChart'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import type { AnalyticsScope } from '@/hooks/analytics/useAnalyticsScope'
import { useAutonomies } from '@/hooks/analytics/useAutonomies'
import { useControlPerformances } from '@/hooks/analytics/useControlPerformances'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AnalyticsRange, FuzzyTuning, TuningChange } from '@/types'
import { getAxisBounds, summarizeValues } from '@/utils/analytics.utils'
import { formatDateTime, formatVietnamDayMonthOf, formatVietnamTime } from '@/utils/date.utils'
import { getFuzzyTuningLabel, getRoleLabel } from '@/utils/label.utils'
import { formatDecimal, formatPercentValue } from '@/utils/number.utils'
import { formatStoredNumber } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

interface ControlTabProps {
  scope: AnalyticsScope
}

// Phần trăm hoặc "_"
function formatPercentOrBlank(value: number | null | undefined, decimals = 1): string {
  return value === null || value === undefined ? '_' : formatPercentValue(value, decimals)
}

// Số lần đóng ngắt mỗi giờ; null khi chưa đủ 15 phút dữ liệu
function formatPerHour(value: number | null | undefined): string {
  return value === null || value === undefined ? '_' : t('{count}/giờ', { count: formatDecimal(value, 1) })
}

// Giá trị một hệ số kèm đơn vị
function formatTuningValue(key: keyof FuzzyTuning, value: number | boolean | undefined): string {
  if (value === undefined) return '_'
  if (typeof value === 'boolean') return value ? t('Bật') : t('Tắt')
  return `${formatStoredNumber(value)}${getFuzzyTuningLabel(key).unit}`
}

function getTimeFormatter(range: AnalyticsRange): (isoDate: string) => string {
  return range === '7d' || range === '30d' ? formatVietnamDayMonthOf : formatVietnamTime
}

// Tab Điều khiển (theo tầng, đặc tả §6): độ ẩm chồng công suất phun sương, quạt; mốc đổi hệ số; ba số phụ;
// lịch sử điều khiển tay; gợi ý hệ số
export function ControlTab({ scope }: ControlTabProps) {
  const palette = usePalette()
  const zone = scope.focusZone
  const zoneId = zone?._id ?? ''
  const performances = useControlPerformances(zoneId ? [zoneId] : [], scope.range)
  const autonomies = useAutonomies(zoneId ? [zoneId] : [], scope.range)
  const [openChange, setOpenChange] = useState<TuningChange | null>(null)
  const performance = performances.byZone.get(zoneId)
  const autonomy = autonomies.byZone.get(zoneId)
  const series = performance?.series ?? []
  const times = series.map(point => point.timestamp)
  const humidity = series.map(point => point.humidity)
  const formatTime = getTimeFormatter(scope.range)
  const thresholds = performance?.thresholds
  const changes = performance?.tuning_changes ?? []
  // Mốc đổi hệ số: điểm đầu tiên từ lúc đổi trở đi
  const markerIndexes = changes
    .map(change => times.findIndex(time => time >= change.changed_at))
    .filter(index => index >= 0)
  const humiditySummary = summarizeValues(humidity)
  // Người đổi lấy từ lịch sử của zone (chỉ có vai trò, không có tên)
  const openHistory = openChange
    ? zone?.fuzzy_tuning_history?.find(entry => entry.changed_at === openChange.changed_at)
    : undefined

  if (!zone) return null

  return (
    <View style={styles.tab}>
      {scope.selectedZoneId === null && (
        <Text variant="small" color={palette.textSecondary}>
          {t('Đang xem {zone} · chọn tầng ở trên để đổi', { zone: zone.name })}
        </Text>
      )}
      <Card>
        <ChartFrame
          title={t('Hiệu quả điều khiển')}
          summary={
            humiditySummary
              ? t('Độ ẩm thấp nhất {min}, cao nhất {max}', {
                  min: formatPercentValue(humiditySummary.min),
                  max: formatPercentValue(humiditySummary.max),
                })
              : t('Hiệu quả điều khiển')
          }
          isLoading={performances.isLoading}
          isError={performances.isError}
          isEmpty={series.length === 0 || !thresholds}
          isFetching={performances.isFetching && !performances.isLoading}
          onRetry={() => performances.refetch()}
          emptyMessage={t('Chưa có dữ liệu điều khiển trong khoảng này (cần firmware từ 1.1.0)')}
          emptyAction={
            scope.range !== '30d' ? { label: t('Xem 30 ngày'), onPress: () => scope.selectRange('30d') } : undefined
          }
          legend={[
            { label: t('Độ ẩm'), color: palette.houseHealthy },
            { label: t('Phun sương %'), color: palette.text },
            { label: t('Quạt %'), color: palette.textSecondary },
          ]}
        >
          {width =>
            thresholds ? (
              <ControlChart
                width={width}
                height={CHART_HEIGHT}
                times={times}
                formatTime={formatTime}
                humidity={humidity}
                misting={series.map(point => point.misting_pct)}
                ventilation={series.map(point => point.ventilation_pct)}
                humidityBounds={{ min: thresholds.humidity_min, max: thresholds.humidity_max }}
                axis={getAxisBounds(humidity, [thresholds.humidity_min, thresholds.humidity_max])}
                markerIndexes={markerIndexes}
              />
            ) : null
          }
        </ChartFrame>
        {changes.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.markers}>
            {changes.map(change => (
              <Pressable
                key={change.changed_at}
                onPress={() => setOpenChange(change)}
                style={[styles.marker, { borderColor: palette.border }]}
                accessibilityRole="button"
                accessibilityLabel={t('Đổi hệ số lúc {time}', { time: formatDateTime(change.changed_at) })}
              >
                <Text variant="small" color={palette.text}>
                  {t('Đổi hệ số {time}', { time: formatDateTime(change.changed_at) })}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <View style={styles.stats}>
          <StatRow
            label={t('Độ ẩm trong ngưỡng')}
            value={formatPercentOrBlank(performance?.stats?.humidityInRangePct)}
          />
          <StatRow
            label={t('Nhiệt độ trong ngưỡng')}
            value={formatPercentOrBlank(performance?.stats?.temperatureInRangePct)}
          />
          <StatRow
            label={t('Đóng ngắt phun sương')}
            value={formatPerHour(performance?.stats?.mistingSwitchesPerHour)}
          />
          <StatRow label={t('Đóng ngắt quạt')} value={formatPerHour(performance?.stats?.ventilationSwitchesPerHour)} />
          <StatRow label={t('Thời gian tự động')} value={formatPercentOrBlank(autonomy?.auto_mode_pct)} />
        </View>
      </Card>

      <OverrideHistoryCard zoneId={zoneId} />
      <SuggestionCard zoneId={zoneId} zoneName={zone.name} farm={scope.farm} />

      <BottomSheet visible={openChange !== null} onClose={() => setOpenChange(null)}>
        <Text variant="heading">{t('Đổi hệ số')}</Text>
        <Text variant="small" color={palette.textSecondary}>
          {openChange ? formatDateTime(openChange.changed_at) : ''}
          {openHistory?.changed_by_role ? ` · ${getRoleLabel(openHistory.changed_by_role)}` : ''}
        </Text>
        <View style={styles.stats}>
          {openChange &&
            (Object.keys(openChange.new_values) as (keyof FuzzyTuning)[]).map(key => (
              <StatRow
                key={key}
                label={getFuzzyTuningLabel(key).label}
                value={`${formatTuningValue(key, openHistory?.old_values[key])} → ${formatTuningValue(key, openChange.new_values[key])}`}
              />
            ))}
        </View>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  tab: { gap: Spacing.md },
  stats: { gap: Spacing.sm },
  markers: { gap: Spacing.sm },
  marker: {
    borderWidth: BorderWidth.regular,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
})
