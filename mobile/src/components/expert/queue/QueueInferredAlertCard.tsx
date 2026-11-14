import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowRight, Clock, MapPin } from 'phosphor-react-native'
import { Card } from '@/components/ui/card'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { usePalette } from '@/hooks/theme/usePalette'
import type { InferredAlert } from '@/types/expert.types'
import { formatTimeAgo } from '@/utils/date.utils'
import { getInferredAlertDescription, getInferredAlertLabel } from '@/utils/inferredAlert.utils'
import { t } from '@/utils/i18n.utils'

interface QueueInferredAlertCardProps {
  alert: InferredAlert
}

export function QueueInferredAlertCard({ alert }: QueueInferredAlertCardProps) {
  const palette = usePalette()
  const router = useRouter()
  const { zoneById, houseById } = useZoneDirectory()

  const alertTitle = getInferredAlertLabel(alert.type)
  const alertDesc = alert.message || getInferredAlertDescription(alert.type)
  const timeStr = formatTimeAgo(alert.created_at)
  const zone = alert.zone_id ? zoneById.get(alert.zone_id) : undefined
  const zoneName = zone?.name
  const houseId = alert.house_id || zone?.house_id
  const houseName = houseId ? houseById.get(houseId)?.name : undefined
  const locationLabel =
    [houseName, zoneName].filter(Boolean).join(' › ') ||
    (alert.zone_id ? t('Tầng / Zone') : t('Toàn nhà'))

  const handleInspect = () => {
    router.push({
      pathname: '/(tabs)/verdicts',
      params: { alertId: alert._id },
    })
  }

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.badgePill, { backgroundColor: palette.severityP2 }]}>
          <View style={[styles.dot, { backgroundColor: palette.alert }]} />
          <Text variant="label" weight="bold" color={palette.severityP2Text}>
            {t('Báo động')}
          </Text>
        </View>

        <View style={styles.timeWrapper}>
          <Clock size={12} color={palette.textSecondary} />
          <Text variant="small" color={palette.textSecondary}>
            {timeStr}
          </Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text variant="heading" weight="semiBold">
          {alertTitle}
        </Text>
        <View style={styles.locationWrapper}>
          <MapPin size={13} color={palette.textSecondary} />
          <Text variant="small" color={palette.textSecondary}>
            {locationLabel}
          </Text>
        </View>
      </View>

      <Text variant="body" color={palette.text} numberOfLines={2} style={styles.description}>
        {alertDesc}
      </Text>

      <PressableScale
        onPress={handleInspect}
        style={[styles.actionButton, { backgroundColor: palette.inverse }]}
        accessibilityRole="button"
        accessibilityLabel={t('Kiểm tra ngay sự cố này')}
      >
        <Text variant="body" weight="semiBold" color={palette.onInverse}>
          {t('Kiểm tra ngay')}
        </Text>
        <ArrowRight size={16} weight="bold" color={palette.onInverse} />
      </PressableScale>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  titleRow: {
    marginTop: Spacing.xs,
  },
  locationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  description: {
    marginTop: Spacing.xs,
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    height: 44,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
})
