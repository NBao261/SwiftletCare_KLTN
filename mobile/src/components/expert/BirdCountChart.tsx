import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { BarGroup, CartesianChart } from 'victory-native'
import { useFont } from '@shopify/react-native-skia'
import { Bird } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
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
  [key: string]: unknown
  index: number
  time: string
  entry_count: number
  exit_count: number
}

/**
 * Biểu đồ cột đếm chim 5 phút ±30 phút (ALERT-FR-014).
 * Phân biệt lưu lượng chim Vào (Entry) và Ra (Exit) theo từng bucket 5 phút.
 * Hiển thị thông báo khi trạng thái missing (không vẽ số 0).
 */
export function BirdCountChart({ birdCounts }: BirdCountChartProps) {
  const palette = usePalette()
  const font = useFont(require('@/assets/fonts/PlusJakartaSans-Medium.ttf'), 10)

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

      {/* Biểu đồ CartesianChart với BarGroup */}
      <View style={styles.chartWrapper}>
        <CartesianChart<ChartItem, 'index', 'entry_count' | 'exit_count'>
          data={chartData}
          xKey="index"
          yKeys={['entry_count', 'exit_count']}
          domainPadding={{ left: 20, right: 20, top: 16, bottom: 10 }}
          axisOptions={{
            font: font ?? undefined,
            tickCount: { x: Math.min(5, Math.max(2, chartData.length)), y: 4 },
            lineColor: palette.divider,
            labelColor: palette.textSecondary,
            formatXLabel: val => {
              const idx = Math.round(Number(val))
              return chartData[idx]?.time ?? ''
            },
            formatYLabel: val => `${Math.round(Number(val))}`,
          }}
        >
          {({ points, chartBounds }) => (
            <BarGroup
              chartBounds={chartBounds}
              betweenGroupPadding={0.3}
              withinGroupPadding={0.1}
              roundedCorners={{ topLeft: 4, topRight: 4 }}
            >
              <BarGroup.Bar points={points.entry_count} color={palette.houseHealthy} />
              <BarGroup.Bar points={points.exit_count} color={palette.text} />
            </BarGroup>
          )}
        </CartesianChart>
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
})
