import { Pressable, StyleSheet, View } from 'react-native'
import { CaretRightIcon, UserPlusIcon } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import type { FarmSummary } from '@/hooks/farm/useFarmSummary'
import { usePalette } from '@/hooks/theme/usePalette'
import type { AlertSeverity } from '@/types'
import { t } from '@/utils/i18n.utils'
import { getSeverityLevel, getSeverityLevelLabel, SEVERITY_LEVELS } from '@/utils/severity.utils'

// Nhãn cao ~24, nới vùng chạm cho đủ 44 (MOBILE_GUIDE 3.7)
const BADGE_HIT_SLOP = 10

interface FarmSummaryStripProps {
  summary: FarmSummary
  // Chưa tải xong số theo mức thì null, hiện "_"
  severityCounts: Record<AlertSeverity, number> | null
  // null: người dùng không xem được thành viên farm nên không biết farm có chuyên gia hay không — ẩn nhãn
  hasExpert: boolean | null
  // Zone, thiết bị chưa tải xong thì số hiện "_"
  isDetailLoading: boolean
  // Farm chưa có chuyên gia: bấm nhãn "Chưa có chuyên gia" mở Thành viên để mời; không truyền thì nhãn chỉ để xem
  onInviteExpert?: () => void
}

// Dải tóm tắt farm dưới thanh trên: số nhà, tầng, thiết bị online và cảnh báo theo mức
export function FarmSummaryStrip({ summary, severityCounts, hasExpert, isDetailLoading, onInviteExpert }: FarmSummaryStripProps) {
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

  const badgeStyle = [styles.badge, { backgroundColor: palette.surfaceStrong }]

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text variant="body" weight="semiBold" style={styles.flexText}>
          {t('{houses} nhà · {zones} khu vực', { houses: summary.houseCount, zones: zoneText })}
        </Text>
        {/* Farm có chuyên gia thì chuyên gia quyết các tham số phát hiện; chưa có thì chủ trại quyết thay (BR-22) và được nhắc
            mời chuyên gia. Nhãn xám, không cam: thiếu chuyên gia không phải cảnh báo hay lỗi */}
        {hasExpert === null ? null : hasExpert ? (
          <View style={badgeStyle}>
            <Text variant="label">{t('Có chuyên gia')}</Text>
          </View>
        ) : onInviteExpert ? (
          <Pressable
            onPress={onInviteExpert}
            hitSlop={BADGE_HIT_SLOP}
            style={badgeStyle}
            accessibilityRole="button"
            accessibilityLabel={t('Chưa có chuyên gia')}
            accessibilityHint={t('Mở thành viên để mời chuyên gia')}
          >
            <UserPlusIcon size={14} color={palette.text} weight="bold" />
            <Text variant="label">{t('Chưa có chuyên gia')}</Text>
            <CaretRightIcon size={12} color={palette.text} weight="bold" />
          </Pressable>
        ) : (
          <View style={badgeStyle}>
            <UserPlusIcon size={14} color={palette.text} weight="bold" />
            <Text variant="label">{t('Chưa có chuyên gia')}</Text>
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
})
