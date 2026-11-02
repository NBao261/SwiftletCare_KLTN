import { ScrollView, StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

/** [S01] Hàng đợi công việc của Domain Expert — EXPERT-FR-007 */
export default function QueueScreen() {
  const palette = usePalette()
  const language = useLanguage()

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Hàng đợi')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxl * 3 }]}
      >
        <Card style={styles.card}>
          <Text variant="heading">{t('Hàng đợi công việc')}</Text>
          <Text variant="small" color={palette.textSecondary} style={styles.subtitle}>
            {t('Các hạng mục cần thẩm định, review và phê duyệt sẽ hiển thị tại đây.')}
          </Text>
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  card: {
    padding: Spacing.lg,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
})
