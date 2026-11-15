import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { ExpertDecisionList } from '@/components/profile/ExpertDecisionList'
import { EmptyState } from '@/components/ui/empty-state'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useFarms } from '@/hooks/farm/useFarms'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import { isDomainExpert } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

/**
 * [S13] Nhật ký hoạt động & phán quyết của Chuyên gia trên farm (EXPERT-FR-009, BR-22).
 * Dùng chung ExpertDecisionList với trang Hoạt động chuyên gia của Farm Owner: tải thêm theo trang (meta),
 * nhãn hành động lấy từ account.utils để khớp enum backend.
 */
export default function ExpertActivityScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const router = useRouter()
  const user = useAuthStore(state => state.user)
  const selectedFarmId = useExpertScopeStore(state => state.selectedFarmId)
  const { data: farmsData } = useFarms()
  const effectiveFarmId = selectedFarmId || farmsData?.data?.[0]?._id || ''

  if (!isDomainExpert(user)) return <Redirect href="/(tabs)/queue" />

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Nhật ký xử lý kỹ thuật')} onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_OVERLAP + Spacing.xxl }]}
      >
        <Text variant="small" color={palette.textSecondary}>
          {t('Mọi quyết định kỹ thuật của chuyên gia trên trang trại này, mới nhất trước.')}
        </Text>

        {effectiveFarmId ? (
          <ExpertDecisionList farmId={effectiveFarmId} enabled />
        ) : (
          <EmptyState message={t('Chưa có trang trại nào để hiển thị hoạt động.')} />
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
})
