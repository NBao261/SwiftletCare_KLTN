import { ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { HealthDayDetail } from '@/components/health/HealthDayDetail'
import { HealthRatingForm } from '@/components/health/HealthRatingForm'
import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { Spacing } from '@/constants/theme'
import { useHealthDay } from '@/hooks/health/useHealthDay'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useAuthStore } from '@/stores/authStore'
import { readApiError } from '@/utils/apiError.utils'
import { isHealthDayHidden } from '@/utils/healthDay.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const SKELETON_HEIGHT = 320

/** Một ngày của một nhà: còn chờ chấm thì hỏi đánh giá của người dùng trước (EXPERT-FR-012, BR-31, BR-37),
 * chấm hoặc bỏ qua xong mới hiện trạng thái, lý do, chỉ số và các đánh giá (ANALYTICS-FR-012) */
export default function HealthDayScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const toast = useToastMessage()
  const user = useAuthStore(state => state.user)
  const { dayId } = useLocalSearchParams<{ dayId: string }>()
  const dayQuery = useHealthDay(dayId)
  const day = dayQuery.data

  const renderBody = () => {
    if (dayQuery.isLoading) return <Skeleton width="100%" height={SKELETON_HEIGHT} />
    if (dayQuery.isError || !day) {
      return readApiError(dayQuery.error).status === 404 ? (
        <EmptyState message={t('Không tìm thấy ngày này')} />
      ) : (
        <EmptyState message={t('Không tải được')} actionLabel={t('Thử lại')} onAction={() => dayQuery.refetch()} />
      )
    }
    if (isHealthDayHidden(day)) {
      // Người không chấm không có form (backend trả 403); ngày chờ chấm vẫn che trạng thái
      if (!canPerform(user, 'rateHealthDay')) {
        return (
          <Text variant="body" color={palette.textSecondary}>
            {t('Ngày này chưa có trạng thái để xem')}
          </Text>
        )
      }
      return (
        <HealthRatingForm
          key={day._id}
          day={day}
          onRevealed={toast.show}
          onClosed={message => {
            toast.show(message)
            dayQuery.refetch()
          }}
        />
      )
    }
    return <HealthDayDetail day={day} onMessage={toast.show} />
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View key={language} style={styles.screen}>
        <AppHeader title={t('Trạng thái ngày')} onBack={() => router.back()} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        >
          {renderBody()}
        </ScrollView>
      </View>
      {toast.message && <Toast message={toast.message} bottomOffset={insets.bottom + Spacing.xxl} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
})
