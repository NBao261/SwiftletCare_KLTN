import { Alert as NativeAlert, StyleSheet, View } from 'react-native'
import { FormMessage } from '@/components/ui/form-message'
import { Switch } from '@/components/ui/switch'
import { Text } from '@/components/ui/text'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useUpdateNotificationPreferences } from '@/hooks/auth/useUpdateNotificationPreferences'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { ChannelChoice } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import {
  buildBySeverityPayload,
  getGeneralChannels,
  getLevelChannels,
  urgentHasOutsideChannel,
} from '@/utils/notificationChannel.utils'
import { getSeverityLevelLabel, SEVERITY_LEVELS, type SeverityLevel } from '@/utils/severity.utils'
import { t } from '@/utils/i18n.utils'

const CHANNELS: { key: keyof ChannelChoice; label: string }[] = [
  { key: 'push', label: 'Push' },
  { key: 'telegram', label: 'Telegram' },
]
const CHANNEL_CELL_WIDTH = 72

// Bảng kênh ngoài app theo mức cảnh báo (ALERT-FR-005): mỗi mức Khẩn cấp · Cao · Thường bật/tắt Push và Telegram, lưu ngay
// (by_severity, cùng web). Mức Khẩn cấp phải còn ít nhất một kênh ngoài app; Telegram chỉ bật được khi đã liên kết bot.
// Tắt kênh thì cảnh báo vẫn có trong tab Cảnh báo
export function SeverityChannelTable() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const updatePreferences = useUpdateNotificationPreferences()
  const preferences = user?.notification_preferences
  const levels = getLevelChannels(preferences)
  const isTelegramLinked = Boolean(user?.telegram_linked)

  const toggle = (level: SeverityLevel, channel: keyof ChannelChoice, value: boolean) => {
    const next = { ...levels, [level]: { ...levels[level], [channel]: value } }
    if (level === 'P1' && !urgentHasOutsideChannel(next.P1, isTelegramLinked)) {
      NativeAlert.alert(
        t('Không tắt được'),
        t('Cảnh báo khẩn cấp phải còn ít nhất một kênh ngoài app (Push hoặc Telegram đã liên kết).'),
      )
      return
    }
    updatePreferences.mutate({ by_severity: buildBySeverityPayload(next, getGeneralChannels(preferences)) })
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.table, { borderColor: palette.border }]}>
        <View style={[styles.row, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" weight="semiBold" style={styles.levelCell}>
            {t('Mức cảnh báo')}
          </Text>
          {CHANNELS.map(channel => (
            <Text key={channel.key} variant="small" weight="semiBold" center style={styles.channelCell}>
              {t(channel.label)}
            </Text>
          ))}
        </View>
        {SEVERITY_LEVELS.map((level, index) => (
          <View
            key={level}
            style={[styles.row, index > 0 && { borderTopWidth: BorderWidth.hairline, borderTopColor: palette.divider }]}
          >
            <Text variant="body" style={styles.levelCell}>
              {getSeverityLevelLabel(level)}
            </Text>
            {CHANNELS.map(channel => (
              <View key={channel.key} style={styles.channelCell}>
                <Switch
                  value={levels[level][channel.key] && (channel.key !== 'telegram' || isTelegramLinked)}
                  onValueChange={value => toggle(level, channel.key, value)}
                  disabled={updatePreferences.isPending || (channel.key === 'telegram' && !isTelegramLinked)}
                  accessibilityLabel={`${getSeverityLevelLabel(level)}, ${t(channel.label)}`}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
      <FormMessage message={updatePreferences.error ? getSettingsErrorMessage(updatePreferences.error) : null} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.sm },
  table: { borderWidth: BorderWidth.hairline, borderRadius: Radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  levelCell: { flex: 1, paddingRight: Spacing.sm },
  channelCell: { width: CHANNEL_CELL_WIDTH, alignItems: 'center' },
})
