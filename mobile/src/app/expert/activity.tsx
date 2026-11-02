import React from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Clock, SlidersHorizontal } from 'phosphor-react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useExpertActivity } from '@/hooks/expert/useExpertReports'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import type { ExpertActionType, ExpertActivityEntry } from '@/types'
import { formatDateTime } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

const ACTION_LABELS: Record<ExpertActionType, string> = {
  ALERT_VERDICT_SET: 'Thẩm định cảnh báo suy luận',
  THRESHOLD_UPDATED: 'Hiệu chỉnh ngưỡng vi khí hậu',
  THRESHOLD_RESET: 'Khôi phục ngưỡng mặc định',
  FUZZY_UPDATED: 'Hiệu chỉnh hệ số mờ Fuzzy',
  DETECTION_TUNING_UPDATED: 'Cập nhật tham số phát hiện dị thường',
  REVIEW_ACCEPTED: 'Chấp thuận thay đổi của Chủ trại',
  REVIEW_REVERTED: 'Hoàn nguyên thay đổi của Chủ trại',
  REVIEW_ADJUSTED: 'Hiệu chỉnh thông số từ yêu cầu của Chủ trại',
  PROPOSAL_APPROVED: 'Phê duyệt đề xuất hệ số mờ',
  PROPOSAL_REJECTED: 'Từ chối đề xuất hệ số mờ',
  CONCLUSION_WRITTEN: 'Ban hành kết luận báo cáo sức khỏe',
  COUNTING_RING_SET: 'Cập nhật vòng đếm chim camera',
  COUNTING_SCHEDULE_SET: 'Cập nhật lịch đếm chim',
}

/**
 * [S13] Màn hình Nhật ký hoạt động & Phán quyết của Chuyên gia (EXPERT-FR-009, BZ-14)
 */
export default function ExpertActivityScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const router = useRouter()
  const selectedFarmId = useExpertScopeStore(state => state.selectedFarmId)

  const { data: activityResponse, isLoading, isRefetching, refetch } = useExpertActivity(selectedFarmId || '')

  const activities: ExpertActivityEntry[] = activityResponse?.data || []

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Nhật ký hoạt động')} onBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <Skeleton width="100%" height={80} radius={Radius.lg} />
          <View style={{ height: Spacing.sm }} />
          <Skeleton width="100%" height={80} radius={Radius.lg} />
          <View style={{ height: Spacing.sm }} />
          <Skeleton width="100%" height={80} radius={Radius.lg} />
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState message={t('Chưa có lịch sử hoạt động chuyên gia nào trên trang trại này.')} />
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={item => item._id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={[styles.listContent, { paddingBottom: Spacing.xxl * 3 }]}
          renderItem={({ item }) => {
            const actionText = ACTION_LABELS[item.action] || t('Thao tác chuyên gia')
            const actorName = item.actor?.full_name || t('Chuyên gia')
            const dateStr = formatDateTime(item.created_at)

            return (
              <View
                style={[
                  styles.card,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    <SlidersHorizontal size={16} color={palette.text} />
                    <Text variant="body" weight="bold">
                      {actionText}
                    </Text>
                  </View>
                  <View style={styles.timeRow}>
                    <Clock size={12} color={palette.textSecondary} />
                    <Text variant="small" color={palette.textSecondary}>
                      {dateStr}
                    </Text>
                  </View>
                </View>

                <Text variant="small" color={palette.textSecondary} style={{ marginTop: 2 }}>
                  {actorName} ({item.actor_role === 'DOMAIN_EXPERT' ? t('Chuyên gia') : t('Chủ trại')})
                </Text>

                {item.target_id && (
                  <Text variant="small" color={palette.textSecondary} style={{ marginTop: 2 }}>
                    Mục tiêu: {item.target_type} #{item.target_id.slice(-6)}
                  </Text>
                )}
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  skeletonContainer: {
    padding: Spacing.lg,
  },
  emptyContainer: {
    padding: Spacing.lg,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    elevation: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
})
