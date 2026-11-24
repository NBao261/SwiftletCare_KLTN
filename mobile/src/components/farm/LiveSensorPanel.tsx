import { StyleSheet, View } from 'react-native'
import { SensorTileGrid } from '@/components/farm/SensorTileGrid'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import type { Alert, TelemetryRecord, Thresholds } from '@/types'
import { getForecastMinutesAhead } from '@/utils/alert.utils'
import { formatElapsed } from '@/utils/date.utils'
import { buildSensorTiles } from '@/utils/sensorTile.utils'
import type { SensorMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

// "Cập nhật X giây trước" chạy theo từng giây
const CLOCK_INTERVAL_MS = 1000

interface LiveSensorPanelProps {
  telemetry: TelemetryRecord | null
  thresholds: Thresholds
  // Cảnh báo đang mở của zone: lấy số phút dự báo vượt ngưỡng
  zoneAlerts: Alert[]
  onPressTile: (metric: SensorMetric) => void
}

// Lưới cảm biến + dòng "Cập nhật X giây trước". Nhịp đồng hồ 1 giây nằm riêng ở đây để chỉ khối này vẽ lại mỗi giây,
// không kéo theo cả màn nhà (camera, relay, thiết bị)
export function LiveSensorPanel({ telemetry, thresholds, zoneAlerts, onPressTile }: LiveSensorPanelProps) {
  const palette = usePalette()
  const now = useNow(CLOCK_INTERVAL_MS)
  const tiles = buildSensorTiles(telemetry, thresholds, now)
  const forecastMinutes = {
    temperature: getForecastMinutesAhead(zoneAlerts, 'temperature'),
    humidity: getForecastMinutesAhead(zoneAlerts, 'humidity'),
  }
  const updatedAt = telemetry ? new Date(telemetry.timestamp).getTime() : null

  return (
    <View style={styles.panel}>
      <SensorTileGrid tiles={tiles} forecastMinutes={forecastMinutes} onPressTile={onPressTile} />
      <Text variant="small" color={palette.textSecondary}>
        {updatedAt === null ? t('Chưa có số đo') : t('Cập nhật {elapsed} trước', { elapsed: formatElapsed(now - updatedAt) })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({ panel: { gap: Spacing.sm } })
