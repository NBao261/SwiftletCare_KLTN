import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AlertDetailContent } from '@/components/alert/AlertDetailContent'
import { AppHeader } from '@/components/layout/AppHeader'
import { Toast } from '@/components/ui/toast'
import { Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useNow } from '@/hooks/time/useNow'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { t } from '@/utils/i18n.utils'

const CLOCK_INTERVAL_MS = 60 * 1000

/** Chi tiết cảnh báo dạng trang (ALERT-FR-007…009, 014) — mở từ Trang chủ và sau này từ thông báo push;
 * cùng nội dung với sheet chi tiết của tab Cảnh báo */
export default function AlertDetailScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const now = useNow(CLOCK_INTERVAL_MS)
  const toast = useToastMessage()
  const { alertId } = useLocalSearchParams<{ alertId: string }>()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingBottom: insets.bottom }]}>
      <View key={language} style={styles.screen}>
        <AppHeader title={t('Chi tiết cảnh báo')} onBack={() => router.back()} />
        <AlertDetailContent alertId={alertId} isReady now={now} onMessage={toast.show} />
      </View>
      {toast.message && <Toast message={toast.message} bottomOffset={insets.bottom + Spacing.xxl * 2} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
})
