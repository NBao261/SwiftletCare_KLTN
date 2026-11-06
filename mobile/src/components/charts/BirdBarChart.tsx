import { StyleSheet, View } from 'react-native'
import { BarChart, type barDataItem } from 'react-native-gifted-charts'
import { Text } from '@/components/ui/text'
import { MetricLineChart } from '@/components/charts/MetricLineChart'
import { Spacing, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { BirdPeriodRow } from '@/utils/analytics.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

const Y_AXIS_WIDTH = 40
const NO_OF_SECTIONS = 3
// Khoảng giữa hai cột Ra/Về của cùng một kỳ
const PAIR_GAP = 2
const MAX_X_LABELS = 5
// Phần cao dành cho dải tỉ lệ về tổ dưới cột (kể cả dòng tên)
const RATE_HEIGHT = 80
const RATE_TITLE_HEIGHT = 16

interface BirdBarChartProps {
  width: number
  height: number
  rows: BirdPeriodRow[]
  // Nhãn trục của một kỳ: "26/10", "T44", "10/2026"
  formatLabel: (row: BirdPeriodRow) => string
  // Chạm cột của một kỳ (theo ngày: mở số đếm 5 phút của ngày đó)
  onPressRow?: (row: BirdPeriodRow) => void
}

// Số chia trục vừa đẹp: làm tròn lên bội của lũy thừa 10 gần nhất
function getNiceMax(value: number): number {
  if (value <= 0) return 10
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / magnitude) * magnitude
}

// Đàn chim theo kỳ (ANALYTICS-FR-002): cột đôi Ra (chuỗi chính) / Về (chuỗi phụ), kỳ thiếu phiên tô xám;
// dưới là đường tỉ lệ về tổ, kỳ không đủ phiên để trống chứ không vẽ về 0
export function BirdBarChart({ width, height, rows, formatLabel, onPressRow }: BirdBarChartProps) {
  const palette = usePalette()
  const barsHeight = height - RATE_HEIGHT - Spacing.xl
  const plotWidth = Math.max(width - Y_AXIS_WIDTH - Spacing.sm, 1)
  const slotWidth = plotWidth / Math.max(rows.length, 1)
  const barWidth = Math.max(2, Math.min(16, (slotWidth - PAIR_GAP) * 0.35))
  const groupSpacing = Math.max(2, slotWidth - barWidth * 2 - PAIR_GAP)
  const labelEvery = Math.max(1, Math.ceil(rows.length / MAX_X_LABELS))
  const maxValue = getNiceMax(Math.max(...rows.map(row => Math.max(row.exit, row.entry)), 0))
  const textStyle = [styles.axisText, { color: palette.textSecondary }]

  const barData: barDataItem[] = rows.flatMap((row, index) => {
    const onPress = onPressRow ? () => onPressRow(row) : undefined
    return [
      {
        value: row.exit,
        frontColor: row.isIncomplete ? palette.textSecondary : palette.houseHealthy,
        spacing: PAIR_GAP,
        label: index % labelEvery === 0 ? formatLabel(row) : '',
        labelWidth: barWidth * 2 + PAIR_GAP + groupSpacing,
        labelTextStyle: textStyle,
        onPress,
      },
      {
        value: row.entry,
        frontColor: row.isIncomplete ? palette.border : palette.text,
        spacing: groupSpacing,
        onPress,
      },
    ]
  })

  return (
    <View style={styles.stack}>
      <BarChart
        data={barData}
        width={plotWidth}
        height={barsHeight}
        barWidth={barWidth}
        initialSpacing={groupSpacing / 2}
        endSpacing={0}
        maxValue={maxValue}
        noOfSections={NO_OF_SECTIONS}
        formatYLabel={label => formatDecimal(Number(label))}
        yAxisLabelWidth={Y_AXIS_WIDTH}
        yAxisThickness={0}
        yAxisColor="transparent"
        xAxisColor={palette.border}
        xAxisThickness={1}
        rulesColor={palette.divider}
        rulesType="solid"
        yAxisTextStyle={textStyle}
        disableScroll
        isAnimated={false}
      />
      <Text variant="small" color={palette.textSecondary} style={styles.rateTitle}>
        {t('Tỉ lệ về tổ (%)')}
      </Text>
      <MetricLineChart
        width={width}
        height={RATE_HEIGHT - RATE_TITLE_HEIGHT}
        times={rows.map(row => row.startDate)}
        formatTime={date => {
          const row = rows.find(item => item.startDate === date)
          return row ? formatLabel(row) : ''
        }}
        hideTimeLabels
        series={[
          {
            key: 'rate',
            label: t('Tỉ lệ về tổ'),
            color: palette.houseHealthy,
            values: rows.map(row => (row.returnRate === null ? null : Math.round(row.returnRate * 10) / 10)),
          },
        ]}
        axis={{ base: 0, top: Math.max(100, ...rows.map(row => Math.ceil(row.returnRate ?? 0))) }}
        decimals={1}
        unit="%"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.xs },
  rateTitle: { height: RATE_TITLE_HEIGHT },
  axisText: { fontFamily: Typography.small.fontFamily, fontSize: Typography.small.fontSize },
})
