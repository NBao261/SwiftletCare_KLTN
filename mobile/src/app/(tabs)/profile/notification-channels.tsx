import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { SeverityChannelTable } from '@/components/alert/SeverityChannelTable'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

/**
 * Kênh ngoài app theo mức cảnh báo (ALERT-FR-005, by_severity như web): tắt một kênh thì mức đó không gửi qua kênh ấy, cảnh báo
 * vẫn có trong tab Cảnh báo; giờ yên lặng vẫn áp dụng. Chủ trại và kỹ thuật viên nhận cảnh báo ngoài app; chuyên gia thì không
 */
export default function NotificationChannelsScreen() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)

  if (!canPerform(user, 'editNotificationSettings')) return <Redirect href="/(tabs)/profile" />

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Kênh theo mức cảnh báo')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + TAB_BAR_OVERLAP }]}
      >
        <View style={styles.intro}>
          <Text variant="small" color={palette.textSecondary}>
            {t('Tắt một kênh thì mức cảnh báo đó không gửi qua kênh ấy; cảnh báo vẫn hiện trong tab Cảnh báo. Giờ yên lặng vẫn áp dụng.')}
          </Text>
          {!user?.telegram_linked && (
            <Text variant="small" color={palette.textSecondary}>
              {t('Telegram chưa liên kết: liên kết ở mục Kênh nhận cảnh báo.')}
            </Text>
          )}
        </View>
        <Card>
          <SeverityChannelTable />
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  intro: { gap: Spacing.sm },
})
