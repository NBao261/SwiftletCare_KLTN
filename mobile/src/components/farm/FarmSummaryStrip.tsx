import { StyleSheet, View } from 'react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import type { FarmSummary } from '@/hooks/farm/useFarmSummary'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertSeverity } from '@/types'
import { getSeverityLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

const SEVERITY_ORDER: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

interface FarmSummaryStripProps {
  summary: FarmSummary
  // Chưa tải xong số theo mức thì null, hiện "_"
  severityCounts: Record<AlertSeverity, number> | null
  hasExpert: boolean
  // Zone, thiết bị chưa tải xong thì số hiện "_"
  isDetailLoading: boolean
}

// Dải tóm tắt farm dưới thanh trên: số nhà, tầng, thiết bị online và cảnh báo theo mức
export function FarmSummaryStrip({ summary, severityCounts, hasExpert, isDetailLoading }: FarmSummaryStripProps) {
  const palette = usePalette()
  const zoneText = isDetailLoading ? '_' : String(summary.zoneCount)
  const deviceText = isDetailLoading ? '_' : `${summary.deviceOnlineCount}/${summary.deviceCount}`
  const activeSeverities = severityCounts ? SEVERITY_ORDER.filter(severity => severityCounts[severity] > 0) : []
  const alertText = !severityCounts
    ? '_'
    : activeSeverities.length === 0
      ? t('Không có cảnh báo')
      : activeSeverities.map(severity => `${getSeverityLabel(severity)} ${severityCounts[severity]}`).join(' · ')

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text variant="body" weight="semiBold" style={styles.flexText}>
          {t('{houses} nhà · {zones} tầng', { houses: summary.houseCount, zones: zoneText })}
        </Text>
        {/* Nhãn tĩnh: farm có chuyên gia thì chuyên gia quyết các tham số phát hiện (BR-22) */}
        {hasExpert && (
          <View style={[styles.expertBadge, { backgroundColor: palette.surfaceStrong }]}>
            <Text variant="label">{t('Có chuyên gia')}</Text>
          </View>
        )}
      </View>
      <Text variant="small" color={palette.textSecondary}>
        {t('{devices} thiết bị online · {alerts}', { devices: deviceText, alerts: alertText })}
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flexText: { flex: 1 },
  expertBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
})
