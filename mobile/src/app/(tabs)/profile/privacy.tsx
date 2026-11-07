import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { POLICY_EFFECTIVE_DATE, POLICY_VERSION, PRIVACY_POLICY_SECTIONS } from '@/constants/privacyPolicy'
import { Spacing } from '@/constants/theme'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { t } from '@/utils/i18n.utils'

/** Chính sách quyền riêng tư — cùng nội dung trang /settings/privacy của web; mọi role đã đăng nhập đều đọc được */
export default function PrivacyScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const sections = PRIVACY_POLICY_SECTIONS[language]

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Chính sách quyền riêng tư')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + TAB_BAR_OVERLAP }]}
      >
        <Text variant="small" color={palette.textSecondary}>
          {t('Phiên bản {version} · Hiệu lực từ {date}', { version: POLICY_VERSION, date: POLICY_EFFECTIVE_DATE })}
        </Text>

        <Card style={styles.card}>
          {sections.map(section => (
            <View key={section.title} style={styles.section}>
              <Text variant="body" weight="semiBold" accessibilityRole="header">
                {section.title}
              </Text>
              {section.items?.map(item => (
                <View key={item} style={styles.item}>
                  <Text variant="body" color={palette.textSecondary}>
                    •
                  </Text>
                  <Text variant="body" style={styles.itemText}>
                    {item}
                  </Text>
                </View>
              ))}
              {section.paragraphs?.map(paragraph => (
                <Text key={paragraph} variant="body">
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  card: { padding: Spacing.lg, gap: Spacing.lg },
  section: { gap: Spacing.xs },
  item: { flexDirection: 'row', gap: Spacing.sm },
  itemText: { flex: 1 },
})
