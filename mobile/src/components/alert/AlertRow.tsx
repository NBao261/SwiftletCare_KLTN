import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import * as Haptics from 'expo-haptics'
import { CheckIcon } from 'phosphor-react-native'
import { SeverityLabel } from '@/components/alert/SeverityLabel'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Alert } from '@/types'
import { getRenotifyState, isInferredAlert } from '@/utils/alertList.utils'
import { formatDateTime, formatTimeAgo } from '@/utils/date.utils'
import { getAlertStatusLabel, getAlertTypeLabel, getSeverityLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

// Hàng cao cố định để danh sách dài cuộn mượt (đặc tả §8)
export const ALERT_ROW_HEIGHT = 112
const ACTION_WIDTH = 96

interface AlertRowProps {
  alert: Alert
  locationText: string
  now: number
  // Chủ trại vuốt sang trái để xác nhận; không truyền thì hàng không vuốt được
  onAcknowledge?: () => void
  onPress: () => void
  // Cảnh báo mới vào khi đang mở app: viền nháy một lần
  isNew?: boolean
}

// Một hàng cảnh báo (đặc tả §2.5): mức + loại, vị trí, trạng thái, thời gian gần nhất, số lần lặp,
// "Chờ phán quyết" của loại suy luận, đếm ngược nhắc lại (ALERT-FR-015)
export function AlertRow({ alert, locationText, now, onAcknowledge, onPress, isNew = false }: AlertRowProps) {
  const palette = usePalette()
  const swipeRef = useRef<SwipeableMethods>(null)
  const [isFullTime, setFullTime] = useState(false)
  const latest = alert.last_seen_at ?? alert.created_at
  const occurrences = alert.occurrence_count ?? 1
  const renotify = getRenotifyState(alert, now)
  const isPendingVerdict = isInferredAlert(alert) && !alert.expert_verdict
  const canSwipe = Boolean(onAcknowledge) && alert.status === 'ACTIVE'

  const meta = [
    getAlertStatusLabel(alert.status),
    isFullTime ? formatDateTime(latest) : formatTimeAgo(latest),
    occurrences > 1 ? `×${occurrences}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const renotifyText =
    renotify?.kind === 'sent'
      ? t('Đã nhắc lại')
      : renotify?.kind === 'countdown'
        ? renotify.minutes > 0
          ? t('Nhắc lại sau {minutes} phút', { minutes: renotify.minutes })
          : t('Sắp nhắc lại')
        : null

  const content = (
    <Pressable
      onPress={onPress}
      onLongPress={() => setFullTime(current => !current)}
      style={[styles.row, { backgroundColor: palette.surface, borderColor: isNew ? palette.alert : 'transparent' }]}
      accessibilityRole="button"
      accessibilityLabel={[
        getSeverityLabel(alert.severity),
        getAlertTypeLabel(alert.type),
        locationText,
        getAlertStatusLabel(alert.status),
        formatTimeAgo(latest),
      ].join(', ')}
      accessibilityHint={canSwipe ? t('Vuốt sang trái để xác nhận, hoặc mở chi tiết') : t('Mở chi tiết cảnh báo')}
    >
      <View style={styles.titleRow}>
        <SeverityLabel severity={alert.severity} />
        <Text variant="body" weight="semiBold" numberOfLines={1} style={styles.flex}>
          {getAlertTypeLabel(alert.type)}
        </Text>
      </View>
      <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
        {locationText}
      </Text>
      <View style={styles.metaRow}>
        <Text variant="small" numberOfLines={1} style={styles.flex}>
          {meta}
        </Text>
        {isPendingVerdict && (
          <View style={[styles.tag, { backgroundColor: palette.surfaceStrong }]}>
            <Text variant="small" weight="semiBold">
              {t('Chờ phán quyết')}
            </Text>
          </View>
        )}
      </View>
      {renotifyText && (
        <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
          {renotifyText}
        </Text>
      )}
    </Pressable>
  )

  if (!canSwipe || !onAcknowledge) return content

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={ACTION_WIDTH / 2}
      onSwipeableWillOpen={() => Haptics.selectionAsync().catch(() => undefined)}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            swipeRef.current?.close()
            onAcknowledge()
          }}
          style={[styles.action, { backgroundColor: palette.inverse }]}
          accessibilityRole="button"
          accessibilityLabel={t('Xác nhận cảnh báo')}
        >
          <CheckIcon size={20} color={palette.onInverse} weight="bold" />
          <Text variant="small" weight="semiBold" color={palette.onInverse}>
            {t('Xác nhận')}
          </Text>
        </Pressable>
      )}
    >
      {content}
    </ReanimatedSwipeable>
  )
}

const styles = StyleSheet.create({
  row: {
    height: ALERT_ROW_HEIGHT,
    borderRadius: Radius.lg,
    borderWidth: BorderWidth.strong,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  tag: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  action: {
    width: ACTION_WIDTH,
    marginLeft: Spacing.sm,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
})
