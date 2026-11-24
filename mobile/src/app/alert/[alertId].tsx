import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AlertDetailContent } from '@/components/alert/AlertDetailContent'
import { AppHeader } from '@/components/layout/AppHeader'
import { Toast } from '@/components/ui/toast'
import { Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { t } from '@/utils/i18n.utils'
import { buildAlertReturnTo } from '@/utils/navigation.utils'

/** Chi tiết cảnh báo dạng trang (ALERT-FR-007…009, 014) — chỗ duy nhất xem chi tiết cảnh báo: mở từ hàng ở tab Cảnh báo,
 * Trang chủ, chuông, thông báo đẩy và phiếu công việc (chuyển trang, không có sheet chi tiết). ‹ quay về màn đã mở; mở thẳng
 * từ thông báo đẩy lúc app vừa khởi động (không có màn trước) thì về Trang chủ */
export default function AlertDetailScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const toast = useToastMessage()
  const goBack = useGoBackOrHome()
  const { alertId } = useLocalSearchParams<{ alertId: string }>()

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingBottom: insets.bottom }]}>
      <View key={language} style={styles.screen}>
        <AppHeader title={t('Chi tiết cảnh báo')} onBack={goBack} />
        <AlertDetailContent alertId={alertId} isReady onMessage={toast.show} returnTo={buildAlertReturnTo(alertId)} />
      </View>
      {toast.message && <Toast message={toast.message} bottomOffset={insets.bottom + Spacing.xxl * 2} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
})
