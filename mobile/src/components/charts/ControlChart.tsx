import { StyleSheet } from 'react-native'
import { LineChart, type DataSet, type lineDataItem } from 'react-native-gifted-charts'
import { Spacing, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { formatDecimal } from '@/utils/number.utils'

const Y_AXIS_WIDTH = 40
const NO_OF_SECTIONS = 4
const MAX_X_LABELS = 4
// Vùng công suất loang: đậm ở trên, nhạt dần xuống trục, để đường độ ẩm vẫn rõ
const AREA_START_OPACITY = 0.3
const AREA_END_OPACITY = 0.02

interface ControlChartProps {
  width: number
  height: number
  times: string[]
  formatTime: (isoDate: string) => string
  // Độ ẩm (trục trái) và công suất phun sương, quạt 0–100% (trục phải); null là khung không có số
  humidity: (number | null)[]
  misting: (number | null)[]
  ventilation: (number | null)[]
  humidityBounds: { min: number; max: number }
  axis: { base: number; top: number }
  // Điểm có lần đổi hệ số: vạch dọc
  markerIndexes: number[]
}

// Một chuỗi thành điểm vẽ; null để trống
function toItems(
  values: (number | null)[],
  shift: number,
  markerIndexes: number[],
  markerColor: string,
): lineDataItem[] {
  return values.map((value, index) => ({
    value: value === null ? undefined : value - shift,
    hideDataPoint: true,
    showVerticalLine: markerIndexes.includes(index),
    verticalLineColor: markerColor,
    verticalLineThickness: 1,
  }))
}

// Hiệu quả điều khiển (ANALYTICS-FR-008): đường cong độ ẩm với hai vạch ngưỡng, vùng loang công suất phun sương và quạt theo
// trục phải 0–100%, vạch dọc ở mỗi lần đổi hệ số
export function ControlChart({
  width,
  height,
  times,
  formatTime,
  humidity,
  misting,
  ventilation,
  humidityBounds,
  axis,
  markerIndexes,
}: ControlChartProps) {
  const palette = usePalette()
  const plotWidth = Math.max(width - Y_AXIS_WIDTH * 2 - Spacing.sm, 1)
  const spacing = plotWidth / Math.max(times.length - 1, 1)
  const labelEvery = Math.max(1, Math.ceil(times.length / MAX_X_LABELS))
  const textStyle = [styles.axisText, { color: palette.textSecondary }]
  const referenceConfig = { color: palette.textSecondary, thickness: 1, dashWidth: 4, dashGap: 4 }

  const dataSet: DataSet[] = [
    {
      data: toItems(humidity, axis.base, markerIndexes, palette.text),
      color: palette.houseHealthy,
      thickness: 2,
      curved: true,
    },
    {
      data: toItems(misting, 0, [], palette.text),
      color: palette.text,
      thickness: 1,
      areaChart: true,
      startFillColor: palette.text,
      endFillColor: palette.text,
      startOpacity: AREA_START_OPACITY,
      endOpacity: AREA_END_OPACITY,
      curved: true,
      isSecondary: true,
    },
    {
      data: toItems(ventilation, 0, [], palette.text),
      color: palette.textSecondary,
      thickness: 1,
      areaChart: true,
      startFillColor: palette.textSecondary,
      endFillColor: palette.textSecondary,
      startOpacity: AREA_START_OPACITY,
      endOpacity: AREA_END_OPACITY,
      curved: true,
      isSecondary: true,
    },
  ]

  return (
    <LineChart
      dataSet={dataSet}
      curved
      width={plotWidth}
      height={height - Spacing.xl}
      spacing={spacing}
      initialSpacing={0}
      endSpacing={0}
      maxValue={axis.top - axis.base}
      noOfSections={NO_OF_SECTIONS}
      formatYLabel={label => `${formatDecimal(Number(label) + axis.base)}%`}
      secondaryYAxis={{
        maxValue: 100,
        noOfSections: NO_OF_SECTIONS,
        yAxisColor: 'transparent',
        yAxisThickness: 0,
        yAxisTextStyle: textStyle,
        yAxisLabelWidth: Y_AXIS_WIDTH,
        yAxisLabelSuffix: '%',
      }}
      yAxisLabelWidth={Y_AXIS_WIDTH}
      yAxisThickness={0}
      yAxisColor="transparent"
      xAxisColor={palette.border}
      xAxisThickness={1}
      rulesColor={palette.divider}
      rulesType="solid"
      yAxisTextStyle={textStyle}
      xAxisLabelTexts={times.map((time, index) => (index % labelEvery === 0 ? formatTime(time) : ''))}
      xAxisLabelTextStyle={textStyle}
      interpolateMissingValues={false}
      disableScroll
      isAnimated={false}
      showReferenceLine1
      referenceLine1Position={humidityBounds.max - axis.base}
      referenceLine1Config={referenceConfig}
      showReferenceLine2
      referenceLine2Position={humidityBounds.min - axis.base}
      referenceLine2Config={referenceConfig}
    />
  )
}

const styles = StyleSheet.create({
  axisText: { fontFamily: Typography.small.fontFamily, fontSize: Typography.small.fontSize },
})
