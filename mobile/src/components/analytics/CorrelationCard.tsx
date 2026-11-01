import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { ChartFrame } from '@/components/charts/ChartFrame'
import { MetricLineChart } from '@/components/charts/MetricLineChart'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { BorderWidth, Spacing } from '@/constants/theme'
import { useCorrelations } from '@/hooks/analytics/useCorrelations'
import { usePalette } from '@/hooks/theme/usePalette'
import type { CorrelationPoint, Zone } from '@/types'
import { getAxisBounds, pearson } from '@/utils/analytics.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

const ROW_SKELETON_HEIGHT = 48
const SHEET_CHART_HEIGHT = 120

interface CorrelationCardProps {
  zones: Zone[]
  days: number
}

// "+0,62 cùng chiều" / "−0,40 ngược chiều"; chưa đủ ngày thì "_"
function formatCoefficient(value: number | null): string {
  if (value === null) return '_'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatDecimal(Math.abs(value), 2)} ${value >= 0 ? t('cùng chiều') : t('ngược chiều')}`
}

// "26/10" từ "2026-10-26"
function formatDay(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}

// Một biểu đồ nhỏ theo ngày trong sheet chi tiết
function DailyChart({
  title,
  points,
  pick,
  unit,
  color,
}: {
  title: string
  points: CorrelationPoint[]
  pick: (point: CorrelationPoint) => number | null
  unit: string
  color: string
}) {
  const values = points.map(pick)
  return (
    <ChartFrame
      title={title}
      summary={title}
      height={SHEET_CHART_HEIGHT}
      isLoading={false}
      isError={false}
      isEmpty={values.every(value => value === null)}
      onRetry={() => undefined}
    >
      {width => (
        <MetricLineChart
          width={width}
          height={SHEET_CHART_HEIGHT}
          times={points.map(point => point.date)}
          formatTime={formatDay}
          series={[{ key: title, label: title, color, values }]}
          axis={getAxisBounds(values, [])}
          decimals={1}
          unit={unit}
        />
      )}
    </ChartFrame>
  )
}

// Tương quan môi trường – tỉ lệ về tổ (ANALYTICS-FR-003): mỗi tầng một hàng, hệ số Pearson với nhiệt độ và độ ẩm
// trung bình ngày, app tự tính từ các điểm backend trả. Chạm hàng: sheet các đường theo ngày
export function CorrelationCard({ zones, days }: CorrelationCardProps) {
  const palette = usePalette()
  const correlations = useCorrelations(
    zones.map(zone => zone._id),
    days,
    true,
  )
  const [openZoneId, setOpenZoneId] = useState<string | null>(null)
  const openZone = zones.find(zone => zone._id === openZoneId) ?? null
  const openPoints = openZoneId ? (correlations.pointsByZone.get(openZoneId) ?? []) : []

  return (
    <Card>
      <Text variant="body" weight="semiBold">
        {t('Tương quan môi trường – tỉ lệ về tổ')}
      </Text>
      {correlations.isLoading ? (
        <Skeleton width="100%" height={ROW_SKELETON_HEIGHT * zones.length} />
      ) : correlations.isError ? (
        <Text variant="small" color={palette.textSecondary} onPress={() => correlations.refetch()}>
          {t('Không tải được. Chạm để thử lại')}
        </Text>
      ) : (
        zones.map((zone, index) => {
          const points = correlations.pointsByZone.get(zone._id) ?? []
          const temperature = pearson(points.map(point => [point.avg_temperature, point.return_rate]))
          const humidity = pearson(points.map(point => [point.avg_humidity, point.return_rate]))
          return (
            <Pressable
              key={zone._id}
              onPress={() => setOpenZoneId(zone._id)}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('{zone}: nhiệt độ {temperature}, độ ẩm {humidity}', {
                zone: zone.name,
                temperature: formatCoefficient(temperature),
                humidity: formatCoefficient(humidity),
              })}
            >
              <Text variant="body" weight="semiBold" style={styles.zone} numberOfLines={1}>
                {zone.name}
              </Text>
              <View style={styles.values}>
                <Text variant="small" color={palette.textSecondary}>
                  {t('Nhiệt độ {value}', { value: formatCoefficient(temperature) })}
                </Text>
                <Text variant="small" color={palette.textSecondary}>
                  {t('Độ ẩm {value}', { value: formatCoefficient(humidity) })}
                </Text>
              </View>
              <CaretRightIcon size={16} color={palette.textSecondary} weight="bold" />
            </Pressable>
          )
        })
      )}
      <Text variant="small" color={palette.textSecondary}>
        {t('Hệ số Pearson tính trên {days} ngày gần nhất có đủ số liệu; cần ít nhất 3 ngày.', { days })}
      </Text>

      <BottomSheet visible={openZone !== null} onClose={() => setOpenZoneId(null)}>
        <Text variant="heading">{openZone?.name ?? ''}</Text>
        <DailyChart
          title={t('Tỉ lệ về tổ (%)')}
          points={openPoints}
          pick={point => point.return_rate}
          unit="%"
          color={palette.houseHealthy}
        />
        <DailyChart
          title={t('Độ ẩm trung bình (%)')}
          points={openPoints}
          pick={point => point.avg_humidity}
          unit="%"
          color={palette.text}
        />
        <DailyChart
          title={t('Nhiệt độ trung bình (°C)')}
          points={openPoints}
          pick={point => point.avg_temperature}
          unit="°C"
          color={palette.textSecondary}
        />
      </BottomSheet>
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  zone: { width: '30%' },
  values: { flex: 1, gap: Spacing.xs },
})
