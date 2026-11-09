import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { CartesianChart, Line as VictoryLine } from 'victory-native'
import { DashPathEffect, Line as SkiaLine, useFont, vec } from '@shopify/react-native-skia'
import { Waveform } from 'phosphor-react-native'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
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
  [key: string]: unknown
  index: number
  time: string
  temperature: number | null
  humidity: number | null
  sound_db: number | null
  timestamp: string
}

/**
 * Biểu đồ viễn trắc môi trường ±30 phút (ALERT-FR-014).
 * Sử dụng CartesianChart (Victory Native v42) và Shopify Skia 2.14.
 * Tuân thủ quy tắc: Không vẽ số 0 khi thiếu dữ liệu, hiển thị vạch dóng đứt đoạn tại thời điểm T.
 */
export function EvidenceChart({ telemetry, alertTime, alertType }: EvidenceChartProps) {
  const palette = usePalette()
  const font = useFont(require('@/assets/fonts/PlusJakartaSans-Medium.ttf'), 10)

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

  const yKeys: ('temperature' | 'humidity' | 'sound_db')[] = useMemo(() => {
    return hasSoundData ? ['temperature', 'humidity', 'sound_db'] : ['temperature', 'humidity']
  }, [hasSoundData])

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

      {/* Biểu đồ CartesianChart */}
      <View style={styles.chartWrapper}>
        <CartesianChart<ChartItem, 'index', 'temperature' | 'humidity' | 'sound_db'>
          data={chartData}
          xKey="index"
          yKeys={yKeys}
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
          {({ points, chartBounds }) => {
            const alertX =
              alertIndex >= 0 && points.temperature?.[alertIndex]?.x != null
                ? points.temperature[alertIndex].x
                : alertIndex >= 0 && points.humidity?.[alertIndex]?.x != null
                  ? points.humidity[alertIndex].x
                  : null

            return (
              <>
                <VictoryLine
                  points={points.temperature}
                  color={palette.alert}
                  strokeWidth={2}
                  curveType="monotoneX"
                  connectMissingData
                />
                <VictoryLine
                  points={points.humidity}
                  color={palette.houseHealthy}
                  strokeWidth={2}
                  curveType="monotoneX"
                  connectMissingData
                />
                {hasSoundData && points.sound_db && (
                  <VictoryLine
                    points={points.sound_db}
                    color={palette.textSecondary}
                    strokeWidth={1.5}
                    curveType="monotoneX"
                    connectMissingData
                  />
                )}
                {/* Vạch dóng dọc nét đứt tại thời điểm T */}
                {alertX !== null && (
                  <SkiaLine
                    p1={vec(alertX, chartBounds.top)}
                    p2={vec(alertX, chartBounds.bottom)}
                    color={palette.alert}
                    strokeWidth={1.5}
                  >
                    <DashPathEffect intervals={[4, 4]} />
                  </SkiaLine>
                )}
              </>
            )
          }}
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
})
