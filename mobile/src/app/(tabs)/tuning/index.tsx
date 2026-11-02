import { ScrollView, StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

/** [S03] Tham số vi khí hậu tổng quan của Domain Expert — EXPERT-FR-004, EXPERT-FR-008 */
export default function TuningScreen() {
  const palette = usePalette()
  const language = useLanguage()

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Tham số')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxl * 3 }]}
      >
        <Card style={styles.card}>
          <Text variant="heading">{t('Tham số vi khí hậu')}</Text>
          <Text variant="small" color={palette.textSecondary} style={styles.subtitle}>
            {t('Xem và tinh chỉnh ngưỡng Zone, hệ số mờ Fuzzy và tham số phát hiện bất thường.')}
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
