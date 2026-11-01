import { StyleSheet } from 'react-native'
import { BarChart, type stackDataItem } from 'react-native-gifted-charts'
import { Spacing, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { NestType } from '@/types'
import { NEST_TYPES } from '@/utils/harvest.utils'
import { formatDecimal } from '@/utils/number.utils'

const Y_AXIS_WIDTH = 40
const NO_OF_SECTIONS = 4
// Bo đỉnh đoạn trên cùng của cột như web
const TOP_RADIUS = 4

interface HarvestStackedChartProps {
  width: number
  height: number
  labels: string[]
  // Giá trị từng loại tổ theo từng cột (kg hoặc số tổ)
  valuesByType: Record<NestType, number[]>
  decimals: number
}

// Số chia trục vừa đẹp: làm tròn lên bội của lũy thừa 10 gần nhất
function getNiceMax(value: number): number {
  if (value <= 0) return NO_OF_SECTIONS
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / magnitude) * magnitude
}

// Sản lượng theo kỳ (ANALYTICS-FR-004): cột xếp chồng yến trắng → hồng → huyết từ dưới lên, cùng màu với web
// (nestWhite / nestPink / nestBlood); kỳ không thu thì cột trống
export function HarvestStackedChart({ width, height, labels, valuesByType, decimals }: HarvestStackedChartProps) {
  const palette = usePalette()
  const colors: Record<NestType, string> = {
    RAW: palette.nestWhite,
    CLEANED: palette.nestPink,
    PREMIUM: palette.nestBlood,
  }
  const plotWidth = Math.max(width - Y_AXIS_WIDTH - Spacing.sm, 1)
  const slotWidth = plotWidth / Math.max(labels.length, 1)
  const barWidth = Math.max(4, Math.min(28, slotWidth * 0.6))
  const spacing = Math.max(2, slotWidth - barWidth)
  const totals = labels.map((_label, index) => NEST_TYPES.reduce((total, type) => total + valuesByType[type][index], 0))
  const textStyle = [styles.axisText, { color: palette.textSecondary }]

  const stackData: stackDataItem[] = labels.map((label, index) => {
    const parts = NEST_TYPES.filter(type => valuesByType[type][index] > 0)
    return {
      label,
      labelTextStyle: textStyle,
      spacing,
      // Kỳ không thu vẫn phải có một đoạn: thư viện luôn đọc stacks[0] (barWidth) nên mảng rỗng làm sập biểu đồ.
      // Đoạn giá trị 0 trong suốt giữ chỗ cột mà không vẽ gì
      stacks:
        parts.length === 0
          ? [{ value: 0, color: 'transparent' }]
          : parts.map((type, partIndex) => ({
              value: valuesByType[type][index],
              color: colors[type],
              // Chỉ đoạn trên cùng bo đỉnh
              borderTopLeftRadius: partIndex === parts.length - 1 ? TOP_RADIUS : 0,
              borderTopRightRadius: partIndex === parts.length - 1 ? TOP_RADIUS : 0,
            })),
    }
  })

  return (
    <BarChart
      stackData={stackData}
      width={plotWidth}
      height={height - Spacing.xl}
      barWidth={barWidth}
      initialSpacing={spacing / 2}
      endSpacing={0}
      maxValue={getNiceMax(Math.max(...totals, 0))}
      noOfSections={NO_OF_SECTIONS}
      formatYLabel={label => formatDecimal(Number(label), Number(label) % 1 === 0 ? 0 : decimals)}
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
  )
}

const styles = StyleSheet.create({
  axisText: { fontFamily: Typography.small.fontFamily, fontSize: Typography.small.fontSize },
})
