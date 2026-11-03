import { ScrollView, StyleSheet, Switch, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { MockDataBadge } from '@/components/common/MockDataBadge'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { IS_MOCK_API_ENABLED } from '@/constants/mockApi'
import { BorderWidth, Radius, Spacing } from '@/constants/theme'
import { useNotificationChannels } from '@/hooks/profile/useNotificationChannels'
import { useUpdateNotificationChannel } from '@/hooks/profile/useUpdateNotificationChannel'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { AlertType, NotificationChannelSetting } from '@/types'
import { ALERT_TYPES, getAlertTypeLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const CHANNELS: { key: keyof NotificationChannelSetting; label: string }[] = [
  { key: 'in_app', label: 'Trong app' },
  { key: 'push', label: 'Push' },
  { key: 'telegram', label: 'Telegram' },
]

/**
 * Kênh nhận theo từng loại cảnh báo (ALERT-FR-005): tắt một kênh thì loại đó không gửi qua kênh ấy, cảnh báo vẫn có
 * trong tab Cảnh báo. Backend chỉ có kênh chung — màn dùng dữ liệu mẫu, có nhãn. Chỉ Farm Owner nhận thông báo ngoài app
 */
export default function NotificationChannelsScreen() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const channelsQuery = useNotificationChannels()
  const updateChannel = useUpdateNotificationChannel()

  if (!canPerform(user, 'editNotificationSettings')) return <Redirect href="/(tabs)/profile" />

  const preferences = user?.notification_preferences
  // Loại chưa chọn riêng thì theo kênh chung đang bật (PUT /auth/notification-preferences)
  const getSetting = (type: AlertType): NotificationChannelSetting =>
    channelsQuery.data?.[type] ?? {
      in_app: true,
      push: preferences?.push ?? false,
      telegram: Boolean(preferences?.telegram && user?.telegram_linked),
    }

  const renderBody = () => {
    if (!IS_MOCK_API_ENABLED) return <EmptyState message={t('Kênh theo loại cảnh báo: Sắp có')} />
    if (channelsQuery.isLoading) return <Skeleton width="100%" height={320} radius={Radius.lg} />
    if (channelsQuery.isError) {
      return <EmptyState message={t('Không tải được cài đặt kênh')} actionLabel={t('Thử lại')} onAction={() => channelsQuery.refetch()} />
    }
    return (
      <Card style={styles.table}>
        <View style={[styles.row, styles.headerRow, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" weight="semiBold" style={styles.typeCell}>
            {t('Loại cảnh báo')}
          </Text>
          {CHANNELS.map(channel => (
            <Text key={channel.key} variant="small" weight="semiBold" center style={styles.channelCell}>
              {t(channel.label)}
            </Text>
          ))}
        </View>
        {ALERT_TYPES.map((type, index) => {
          const setting = getSetting(type)
          return (
            <View
              key={type}
              style={[
                styles.row,
                index < ALERT_TYPES.length - 1 && { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider },
              ]}
            >
              <Text variant="small" style={styles.typeCell}>
                {getAlertTypeLabel(type)}
              </Text>
              {CHANNELS.map(channel => {
                // Telegram chỉ bật được khi tài khoản đã liên kết bot (ALERT-FR-013)
                const isDisabled = channel.key === 'telegram' && !user?.telegram_linked
                return (
                  <View key={channel.key} style={styles.channelCell}>
                    <Switch
                      value={setting[channel.key]}
                      disabled={isDisabled || updateChannel.isPending}
                      onValueChange={next => updateChannel.mutate({ type, setting: { ...setting, [channel.key]: next } })}
                      accessibilityLabel={`${getAlertTypeLabel(type)}, ${t(channel.label)}`}
                      trackColor={{ false: palette.border, true: palette.inverse }}
                      thumbColor={palette.surface}
                    />
                  </View>
                )
              })}
            </View>
          )
        })}
      </Card>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Kênh theo loại cảnh báo')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + TAB_BAR_OVERLAP }]}
      >
        <View style={styles.intro}>
          {IS_MOCK_API_ENABLED && <MockDataBadge />}
          <Text variant="small" color={palette.textSecondary}>
            {t('Tắt một kênh thì loại cảnh báo đó không gửi qua kênh ấy; cảnh báo vẫn hiện trong tab Cảnh báo. Giờ yên lặng vẫn áp dụng.')}
          </Text>
          {!user?.telegram_linked && (
            <Text variant="small" color={palette.textSecondary}>
              {t('Telegram chưa liên kết: liên kết ở mục Kênh nhận cảnh báo.')}
            </Text>
          )}
        </View>
        {renderBody()}
      </ScrollView>
    </View>
  )
}

const CHANNEL_CELL_WIDTH = 64

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  intro: { gap: Spacing.sm },
  table: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  headerRow: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  typeCell: { flex: 1, paddingRight: Spacing.sm },
  channelCell: { width: CHANNEL_CELL_WIDTH, alignItems: 'center' },
})
