import React, { useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { LineChart, type DataSet, type lineDataItem } from 'react-native-gifted-charts'
import { Waveform } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing, Typography } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { TelemetrySample } from '@/types'
import { t } from '@/utils/i18n.utils'

interface EvidenceChartProps {
  telemetry?: {
    status: 'ok' | 'missing'
    samples: TelemetrySample[]
  }
  alertTime?: string
  alertType?: string
}

type ChartItem = {
  index: number
  time: string
  temperature: number | null
  humidity: number | null
  sound_db: number | null
  timestamp: string
}

const Y_AXIS_WIDTH = 36
const MAX_X_LABELS = 5

/**
 * Biểu đồ viễn trắc môi trường ±30 phút (ALERT-FR-014).
 * Sử dụng LineChart (react-native-gifted-charts) đồng bộ hệ thống.
 * Tuân thủ quy tắc: Không vẽ số 0 khi thiếu dữ liệu, hiển thị vạch dóng tại thời điểm T.
 */
export function EvidenceChart({ telemetry, alertTime, alertType }: EvidenceChartProps) {
  const palette = usePalette()
  const [chartWidth, setChartWidth] = useState(280)

  const isMissing = !telemetry || telemetry.status === 'missing' || !telemetry.samples || telemetry.samples.length === 0

  const chartData: ChartItem[] = useMemo(() => {
    if (isMissing) return []
    return telemetry.samples.map((s, index) => {
      const d = new Date(s.timestamp)
      const hours = d.getHours().toString().padStart(2, '0')
      const minutes = d.getMinutes().toString().padStart(2, '0')
      const timeLabel = isNaN(d.getTime()) ? `${index}` : `${hours}:${minutes}`
      return {
        index,
        time: timeLabel,
        temperature: typeof s.temperature === 'number' ? s.temperature : null,
        humidity: typeof s.humidity === 'number' ? s.humidity : null,
        sound_db: typeof s.sound_db === 'number' ? s.sound_db : null,
        timestamp: s.timestamp,
      }
    })
  }, [isMissing, telemetry])

  // Tìm index gần nhất với thời điểm phát sinh cảnh báo T
  const alertIndex = useMemo(() => {
    if (!alertTime || chartData.length === 0) return -1
    const targetMs = new Date(alertTime).getTime()
    if (isNaN(targetMs)) return -1

    let closest = 0
    let minDiff = Infinity
    chartData.forEach((item, idx) => {
      const itemMs = new Date(item.timestamp).getTime()
      if (!isNaN(itemMs)) {
        const diff = Math.abs(itemMs - targetMs)
        if (diff < minDiff) {
          minDiff = diff
          closest = idx
        }
      }
    })
    return closest
  }, [alertTime, chartData])

  const hasSoundData = alertType === 'NOISE_ANOMALY' && chartData.some(d => d.sound_db !== null)

  const handleLayout = (event: LayoutChangeEvent) => {
    const measured = Math.floor(event.nativeEvent.layout.width)
    if (measured > 60) setChartWidth(measured)
  }

  if (isMissing) {
    return (
      <View style={[styles.missingBox, { backgroundColor: palette.surfaceStrong }]}>
        <Waveform size={24} color={palette.textSecondary} />
        <Text variant="small" weight="medium" color={palette.textSecondary} style={styles.missingText}>
          {t('Không có dữ liệu viễn trắc (ALERT-FR-014)')}
        </Text>
      </View>
    )
  }

  const plotWidth = Math.max(chartWidth - Y_AXIS_WIDTH - Spacing.sm, 100)
  const spacing = plotWidth / Math.max(chartData.length - 1, 1)
  const labelEvery = Math.max(1, Math.ceil(chartData.length / MAX_X_LABELS))
  const xLabels = chartData.map((item, idx) => (idx % labelEvery === 0 ? item.time : ''))
  const axisTextStyle = [styles.axisText, { color: palette.textSecondary }]

  const getMarker = (index: number): Partial<lineDataItem> =>
    index === alertIndex
      ? { showVerticalLine: true, verticalLineColor: palette.alert, verticalLineThickness: 1.5 }
      : {}

  const toLineData = (getter: (item: ChartItem) => number | null): lineDataItem[] =>
    chartData.map((item, index) => {
      const val = getter(item)
      if (val === null) {
        return { value: undefined, hideDataPoint: true, ...getMarker(index) }
      }
      return { value: val, hideDataPoint: true, ...getMarker(index) }
    })

  const dataSet: DataSet[] = [
    {
      data: toLineData(item => item.temperature),
      color: palette.alert,
      thickness: 2,
      curved: true,
    },
    {
      data: toLineData(item => item.humidity),
      color: palette.houseHealthy,
      thickness: 2,
      curved: true,
    },
  ]

  if (hasSoundData) {
    dataSet.push({
      data: toLineData(item => item.sound_db),
      color: palette.textSecondary,
      thickness: 1.5,
      curved: true,
    })
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.surfaceStrong }]}>
      {/* Legend & Chú giải */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: palette.alert }]} />
          <Text variant="small" color={palette.textSecondary}>
            {t('Nhiệt độ (°C)')}
          </Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: palette.houseHealthy }]} />
          <Text variant="small" color={palette.textSecondary}>
            {t('Độ ẩm (%)')}
          </Text>
        </View>

        {hasSoundData && (
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: palette.textSecondary }]} />
            <Text variant="small" color={palette.textSecondary}>
              {t('Âm thanh (dB)')}
            </Text>
          </View>
        )}

        <View style={styles.legendItem}>
          <View style={[styles.dashedIndicator, { borderColor: palette.alert }]} />
          <Text variant="small" weight="bold" color={palette.alert}>
            {t('Thời điểm T')}
          </Text>
        </View>
      </View>

      {/* Biểu đồ LineChart từ react-native-gifted-charts */}
      <View style={styles.chartWrapper} onLayout={handleLayout}>
        <LineChart
          dataSet={dataSet}
          curved
          width={plotWidth}
          height={148}
          spacing={spacing}
          initialSpacing={0}
          endSpacing={0}
          maxValue={100}
          noOfSections={4}
          formatYLabel={label => `${Math.round(Number(label))}`}
          yAxisLabelWidth={Y_AXIS_WIDTH}
          yAxisThickness={0}
          yAxisColor="transparent"
          xAxisColor={palette.border}
          xAxisThickness={1}
          rulesColor={palette.divider}
          rulesType="solid"
          yAxisTextStyle={axisTextStyle}
          xAxisLabelTexts={xLabels}
          xAxisLabelTextStyle={axisTextStyle}
          interpolateMissingValues={false}
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
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  dashedIndicator: {
    width: 14,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  chartWrapper: {
    height: 180,
    width: '100%',
  },
  axisText: {
    fontFamily: Typography.small.fontFamily,
    fontSize: Typography.small.fontSize,
  },
})
