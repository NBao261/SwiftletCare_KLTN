import { StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'
import { useLanguage } from '@/hooks/i18n/useLanguage'

interface PlaceholderScreenProps {
  title: string
}

// Màn tạm cho menu chưa gán route thật — đổi menu ở src/constants/roleTabs.ts
export function PlaceholderScreen({ title }: PlaceholderScreenProps) {
  const palette = usePalette()
  // Đổi ngôn ngữ thì dựng lại cả màn (key = ngôn ngữ) để mọi chữ ra đúng ngôn ngữ
  const language = useLanguage()

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t(title)} />
      <View style={styles.content}>
        <Text variant="small" color={palette.textSecondary}>
          {t('Đang xây dựng')}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
})
