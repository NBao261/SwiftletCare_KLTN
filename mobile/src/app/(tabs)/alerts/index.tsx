import { StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'
import { t } from '@/utils/i18n.utils'
import { useLanguage } from '@/hooks/i18n/useLanguage'

/** Alert Center – ALERT-FR-007 */
export default function AlertsScreen() {
  const palette = usePalette()
  // Đổi ngôn ngữ thì dựng lại cả màn (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const language = useLanguage()

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Cảnh báo')} />
      <View style={styles.content}>
        {/* TODO: M4
          - Severity filter tabs (ALL | CRITICAL | HIGH | MEDIUM | LOW)
          - Alert list with snapshot thumbnails
          - Swipe-to-acknowledge gesture
        */}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { flex: 1, padding: Spacing.lg },
})
