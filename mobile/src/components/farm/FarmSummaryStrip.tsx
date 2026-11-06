import { StyleSheet, View } from 'react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import type { FarmSummary } from '@/hooks/farm/useFarmSummary'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertSeverity } from '@/types'
import { t } from '@/utils/i18n.utils'
import { getSeverityLevel, getSeverityLevelLabel, SEVERITY_LEVELS } from '@/utils/severity.utils'

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
  // Gộp 4 mức backend thành 3 cấp như web (CRITICAL và HIGH cùng là Khẩn cấp)
  const levelCounts = { P1: 0, P2: 0, P3: 0 }
  if (severityCounts) {
    for (const severity of Object.keys(severityCounts) as AlertSeverity[]) {
      levelCounts[getSeverityLevel(severity)] += severityCounts[severity]
    }
  }
  const activeLevels = SEVERITY_LEVELS.filter(level => levelCounts[level] > 0)
  const alertText = !severityCounts
    ? '_'
    : activeLevels.length === 0
      ? t('Không có cảnh báo')
      : activeLevels.map(level => `${getSeverityLevelLabel(level)} ${levelCounts[level]}`).join(' · ')

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text variant="body" weight="semiBold" style={styles.flexText}>
          {t('{houses} nhà · {zones} khu vực', { houses: summary.houseCount, zones: zoneText })}
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
