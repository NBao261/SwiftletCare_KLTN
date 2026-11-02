import { StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { usePalette } from '@/hooks/theme/usePalette'
import { Spacing } from '@/constants/theme'
import { t } from '@/utils/i18n.utils'
import { useLanguage } from '@/hooks/i18n/useLanguage'

/** Farm List – FARM-FR-001 */
export default function FarmsScreen() {
  const palette = usePalette()
  // Đổi ngôn ngữ thì dựng lại cả màn (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const language = useLanguage()

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Trang trại của bạn')} />
      <View style={styles.content}>
        {/* TODO: M4
          - FlatList of farm cards
          - FAB button to create new farm
          - Pull-to-refresh
        */}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { flex: 1, padding: Spacing.lg },
})
