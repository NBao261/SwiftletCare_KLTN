import { StyleSheet, View } from 'react-native'
import { LineChart, type DataSet, type LineSegment, type lineDataItem } from 'react-native-gifted-charts'
import { Text } from '@/components/ui/text'
import { Radius, Spacing, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { formatDecimal } from '@/utils/number.utils'

const Y_AXIS_WIDTH = 40
const NO_OF_SECTIONS = 4
// Số nhãn tối đa trên trục thời gian để chữ không chồng nhau
const MAX_X_LABELS = 4
const POINTER_LABEL_WIDTH = 140
const POINTER_LABEL_HEIGHT = 64
const DASH_PATTERN = [6, 4]
// Vùng tô dưới đường: đậm ở trên, nhạt dần gần như trong suốt ở trục (kiểu biểu đồ vùng loang)
const AREA_START_OPACITY = 0.3
// Nhiều chuỗi chồng nhau thì tô nhạt hơn để vẫn thấy đường phía sau
const AREA_START_OPACITY_MULTI = 0.15
const AREA_END_OPACITY = 0.02

export interface LineSeries {
  key: string
  label: string
  color: string
  // Cùng độ dài với times; null là khung không có số đo — vẽ khoảng trống, không nối
  values: (number | null)[]
  isDashed?: boolean
  // Điểm ngoài ngưỡng tô cam (chỉ dùng khi xem một chuỗi)
  outOfRange?: boolean[]
}

interface MetricLineChartProps {
  width: number
  height: number
  // Mốc thời gian (ISO) của từng điểm, dùng cho trục và nhãn khi chạm giữ
  times: string[]
  formatTime: (isoDate: string) => string
  series: LineSeries[]
  // Mức thấp, mức cao của zone: vẽ hai vạch nét đứt
  bounds?: { min?: number; max?: number }
  axis: { base: number; top: number }
  decimals: number
  unit: string
  // Ẩn nhãn trục thời gian khi biểu đồ nằm ngay dưới biểu đồ khác cùng trục
  hideTimeLabels?: boolean
  // Tô vùng loang dưới đường (mặc định có); đường nét đứt (dự báo) không tô
  fillArea?: boolean
  // Vạch dọc tại một thời điểm (lúc cảnh báo trong bằng chứng): đặt ở điểm đầu tiên từ mốc đó trở đi
  markerTime?: string
}

// Các đoạn liên tiếp ngoài ngưỡng của một chuỗi, để tô cam riêng đoạn đó
function getOutOfRangeSegments(outOfRange: boolean[] | undefined, color: string): LineSegment[] {
  if (!outOfRange) return []
  const segments: LineSegment[] = []
  let start = -1
  outOfRange.forEach((isOut, index) => {
    if (isOut && start < 0) start = Math.max(0, index - 1)
    if (!isOut && start >= 0) {
      segments.push({ startIndex: start, endIndex: index, color })
      start = -1
    }
  })
  if (start >= 0) segments.push({ startIndex: start, endIndex: outOfRange.length - 1, color })
  return segments
}

// Biểu đồ đường theo thời gian (môi trường, dự báo, so sánh tầng, đếm 5 phút): đường cong mượt, vùng loang bên dưới,
// trục Y không bắt đầu từ 0 mà vừa dữ liệu, khung thiếu số để trống, chạm giữ để xem giờ và giá trị từng chuỗi
export function MetricLineChart({
  width,
  height,
  times,
  formatTime,
  series,
  bounds,
  axis,
  decimals,
  unit,
  hideTimeLabels = false,
  fillArea = true,
  markerTime,
}: MetricLineChartProps) {
  const palette = usePalette()
  const pointCount = times.length
  const plotWidth = Math.max(width - Y_AXIS_WIDTH - Spacing.sm, 1)
  const spacing = plotWidth / Math.max(pointCount - 1, 1)
  const labelEvery = Math.max(1, Math.ceil(pointCount / MAX_X_LABELS))
  const xLabels = times.map((time, index) => (!hideTimeLabels && index % labelEvery === 0 ? formatTime(time) : ''))
  const formatValue = (value: number) => `${formatDecimal(value, decimals)}${unit}`
  const markerIndex = markerTime ? times.findIndex(time => time >= markerTime) : -1

  // Vạch dọc đánh dấu chỉ đặt trên điểm của mốc thời gian
  const getMarker = (index: number): Partial<lineDataItem> =>
    index === markerIndex ? { showVerticalLine: true, verticalLineColor: palette.alert, verticalLineThickness: 1 } : {}

  const dataSet: DataSet[] = series.map(line => ({
    data: line.values.map(
      (value, index): lineDataItem =>
        value === null
          ? { value: undefined, hideDataPoint: true, ...getMarker(index) }
          : {
              ...getMarker(index),
              value: value - axis.base,
              hideDataPoint: !line.outOfRange?.[index],
              dataPointColor: palette.alert,
              dataPointRadius: 3,
            },
    ),
    color: line.color,
    thickness: 2,
    curved: true,
    strokeDashArray: line.isDashed ? DASH_PATTERN : undefined,
    areaChart: fillArea && !line.isDashed,
    startFillColor: line.color,
    endFillColor: line.color,
    startOpacity: series.length > 1 ? AREA_START_OPACITY_MULTI : AREA_START_OPACITY,
    endOpacity: AREA_END_OPACITY,
    lineSegments: getOutOfRangeSegments(line.outOfRange, palette.alert),
  }))

  const referenceConfig = { color: palette.textSecondary, thickness: 1, dashWidth: 4, dashGap: 4 }

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
      formatYLabel={label => formatDecimal(Number(label) + axis.base, Math.min(decimals, 1))}
      yAxisLabelWidth={Y_AXIS_WIDTH}
      yAxisThickness={0}
      yAxisColor="transparent"
      xAxisColor={palette.border}
      xAxisThickness={1}
      rulesColor={palette.divider}
      rulesType="solid"
      yAxisTextStyle={[styles.axisText, { color: palette.textSecondary }]}
      xAxisLabelTexts={xLabels}
      xAxisLabelTextStyle={[styles.axisText, { color: palette.textSecondary }]}
      interpolateMissingValues={false}
      disableScroll
      isAnimated={false}
      showReferenceLine1={bounds?.max !== undefined}
      referenceLine1Position={(bounds?.max ?? 0) - axis.base}
      referenceLine1Config={referenceConfig}
      showReferenceLine2={bounds?.min !== undefined}
      referenceLine2Position={(bounds?.min ?? 0) - axis.base}
      referenceLine2Config={referenceConfig}
      pointerConfig={{
        activatePointersOnLongPress: true,
        autoAdjustPointerLabelPosition: true,
        pointerStripColor: palette.textSecondary,
        pointerStripWidth: 1,
        pointerColorsForDataSet: series.map(line => line.color),
        radius: 4,
        pointerLabelWidth: POINTER_LABEL_WIDTH,
        pointerLabelHeight: POINTER_LABEL_HEIGHT,
        hidePointerForMissingValues: true,
        pointerLabelComponent: (_items: lineDataItem[], _secondary: unknown, pointerIndex: number) => (
          <View style={[styles.pointerLabel, { backgroundColor: palette.inverse }]}>
            <Text variant="small" color={palette.onInverseSecondary}>
              {times[pointerIndex] ? formatTime(times[pointerIndex]) : ''}
            </Text>
            {series.map(line => {
              const value = line.values[pointerIndex]
              return (
                <Text key={line.key} variant="small" weight="semiBold" color={palette.onInverse} numberOfLines={1}>
                  {series.length > 1 ? `${line.label}: ` : ''}
                  {value === null || value === undefined ? '_' : formatValue(value)}
                </Text>
              )
            })}
          </View>
        ),
      }}
    />
  )
}

const styles = StyleSheet.create({
  axisText: { fontFamily: Typography.small.fontFamily, fontSize: Typography.small.fontSize },
  pointerLabel: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
})
