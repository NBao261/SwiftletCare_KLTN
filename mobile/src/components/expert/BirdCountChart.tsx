import React, { useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { BarChart, type barDataItem } from 'react-native-gifted-charts'
import { Bird } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { BirdCountBucket } from '@/types'
import { t } from '@/utils/i18n.utils'

interface BirdCountChartProps {
  birdCounts?: {
    status: 'ok' | 'missing'
    buckets: BirdCountBucket[]
  }
}

type ChartItem = {
  index: number
  time: string
  entry_count: number
  exit_count: number
}

const Y_AXIS_WIDTH = 36
const PAIR_GAP = 2
const MAX_X_LABELS = 5

/**
 * Biểu đồ cột đếm chim 5 phút ±30 phút (ALERT-FR-014).
 * Phân biệt lưu lượng chim Vào (Entry) và Ra (Exit) theo từng bucket 5 phút bằng react-native-gifted-charts.
 * Hiển thị thông báo khi trạng thái missing (không vẽ số 0).
 */
export function BirdCountChart({ birdCounts }: BirdCountChartProps) {
  const palette = usePalette()
  const [chartWidth, setChartWidth] = useState(280)

  const isMissing = !birdCounts || birdCounts.status === 'missing' || !birdCounts.buckets || birdCounts.buckets.length === 0

  const chartData: ChartItem[] = useMemo(() => {
    if (isMissing) return []
    return birdCounts.buckets.map((b, index) => {
      const d = new Date(b.bucket_start)
      const hours = d.getHours().toString().padStart(2, '0')
      const minutes = d.getMinutes().toString().padStart(2, '0')
      const timeLabel = isNaN(d.getTime()) ? `${index}` : `${hours}:${minutes}`
      return {
        index,
        time: timeLabel,
        entry_count: b.entry_count ?? 0,
        exit_count: b.exit_count ?? 0,
      }
    })
  }, [birdCounts, isMissing])

  const { totalEntry, totalExit } = useMemo(() => {
    if (isMissing) return { totalEntry: 0, totalExit: 0 }
    return chartData.reduce(
      (acc, curr) => ({
        totalEntry: acc.totalEntry + curr.entry_count,
        totalExit: acc.totalExit + curr.exit_count,
      }),
      { totalEntry: 0, totalExit: 0 }
    )
  }, [chartData, isMissing])

  const handleLayout = (event: LayoutChangeEvent) => {
    const measured = Math.floor(event.nativeEvent.layout.width)
    if (measured > 60) setChartWidth(measured)
  }

  if (isMissing) {
    return (
      <View style={[styles.missingBox, { backgroundColor: palette.surfaceStrong }]}>
        <Bird size={24} color={palette.textSecondary} />
        <Text variant="small" weight="medium" color={palette.textSecondary} style={styles.missingText}>
          {t('Không có dữ liệu đếm chim (ALERT-FR-014)')}
        </Text>
      </View>
    )
  }

  const plotWidth = Math.max(chartWidth - Y_AXIS_WIDTH - Spacing.sm, 100)
  const slotWidth = plotWidth / Math.max(chartData.length, 1)
  const barWidth = Math.max(3, Math.min(12, (slotWidth - PAIR_GAP) * 0.35))
  const groupSpacing = Math.max(4, slotWidth - barWidth * 2 - PAIR_GAP)
  const labelEvery = Math.max(1, Math.ceil(chartData.length / MAX_X_LABELS))
  const maxValue = Math.max(...chartData.map(item => Math.max(item.entry_count, item.exit_count)), 10)
  const axisTextStyle = [styles.axisText, { color: palette.textSecondary }]

  const barData: barDataItem[] = chartData.flatMap((row, idx) => [
    {
      value: row.entry_count,
      frontColor: palette.houseHealthy,
      spacing: PAIR_GAP,
      label: idx % labelEvery === 0 ? row.time : '',
      labelWidth: barWidth * 2 + PAIR_GAP + groupSpacing,
      labelTextStyle: axisTextStyle,
    },
    {
      value: row.exit_count,
      frontColor: palette.text,
      spacing: groupSpacing,
    },
  ])

  return (
    <View style={[styles.container, { backgroundColor: palette.surfaceStrong }]}>
      {/* Tiêu đề & Tổng kết */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Bird size={16} color={palette.text} />
          <Text variant="small" weight="semiBold">
            {t('Lưu lượng chim ±30 phút (Bucket 5m)')}
          </Text>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.barIndicator, { backgroundColor: palette.houseHealthy }]} />
            <Text variant="small" weight="medium" color={palette.text}>
              {t('Vào: {count}', { count: totalEntry })}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.barIndicator, { backgroundColor: palette.text }]} />
            <Text variant="small" weight="medium" color={palette.textSecondary}>
              {t('Ra: {count}', { count: totalExit })}
            </Text>
          </View>
        </View>
      </View>

      {/* Biểu đồ BarChart từ react-native-gifted-charts */}
      <View style={styles.chartWrapper} onLayout={handleLayout}>
        <BarChart
          data={barData}
          width={plotWidth}
          height={128}
          barWidth={barWidth}
          initialSpacing={groupSpacing / 2}
          endSpacing={0}
          maxValue={maxValue}
          noOfSections={3}
          formatYLabel={label => `${Math.round(Number(label))}`}
          yAxisLabelWidth={Y_AXIS_WIDTH}
          yAxisThickness={0}
          yAxisColor="transparent"
          xAxisColor={palette.border}
          xAxisThickness={1}
          rulesColor={palette.divider}
          rulesType="solid"
          yAxisTextStyle={axisTextStyle}
          disableScroll
          isAnimated={false}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  missingBox: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  missingText: {
    marginTop: Spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  barIndicator: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  chartWrapper: {
    height: 160,
    width: '100%',
  },
  axisText: {
    fontFamily: Typography.small.fontFamily,
    fontSize: Typography.small.fontSize,
  },
})
