import { ScrollView, StyleSheet, View } from 'react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

/** [S02] Cảnh báo suy luận & Thẩm định của Domain Expert — EXPERT-FR-003, ALERT-FR-007 */
export default function VerdictsScreen() {
  const palette = usePalette()
  const language = useLanguage()

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Thẩm định')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.xxl * 3 }]}
      >
        <Card style={styles.card}>
          <Text variant="heading">{t('Cảnh báo suy luận & Thẩm định')}</Text>
          <Text variant="small" color={palette.textSecondary} style={styles.subtitle}>
            {t('Danh sách cảnh báo suy luận đang chờ chuyên gia kiểm chứng.')}
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
