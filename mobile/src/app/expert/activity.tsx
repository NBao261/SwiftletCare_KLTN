import React, { useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Clock,
  SlidersHorizontal,
} from 'phosphor-react-native'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { SplitBadge } from '@/components/ui/split-badge'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useExpertActivity } from '@/hooks/expert/useExpertReports'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import type { ExpertActivityEntry } from '@/types'
import { formatDateTime } from '@/utils/date.utils'
import { t } from '@/utils/i18n.utils'

const ACTION_LABELS: Record<string, string> = {
  ALERT_VERDICT_SET: 'Xác nhận/Bác bỏ cảnh báo',
  THRESHOLD_UPDATED: 'Chỉnh ngưỡng nhiệt ẩm',
  THRESHOLD_RESET: 'Khôi phục dải chuẩn SwiftletCare',
  FUZZY_UPDATED: 'Chỉnh độ nhạy bù ẩm & gió',
  FUZZY_TUNING_UPDATED: 'Chỉnh độ nhạy bù ẩm & gió',
  DETECTION_TUNING_UPDATED: 'Chỉnh thông số bắt lỗi',
  BIRD_COUNT_TUNING_UPDATED: 'Chỉnh ngưỡng sụt giảm chim về',
  REVIEW_ACCEPTED: 'Chấp thuận thay đổi của Chủ nhà',
  REVIEW_REVERTED: 'Hoàn nguyên thay đổi của Chủ nhà',
  REVIEW_ADJUSTED: 'Chỉnh thêm từ yêu cầu của Chủ nhà',
  PROPOSAL_APPROVED: 'Áp dụng đề xuất độ ẩm & gió từ AI',
  PROPOSAL_REJECTED: 'Từ chối đề xuất từ AI',
  CONCLUSION_WRITTEN: 'Ban hành kết luận báo cáo sức khỏe',
  HEALTH_REPORT_CONCLUDED: 'Ban hành kết luận báo cáo sức khỏe',
  COUNTING_RING_SET: 'Cập nhật cửa thu chim camera',
  COUNTING_RING_UPDATED: 'Cập nhật cửa thu chim camera',
  COUNTING_SCHEDULE_SET: 'Cập nhật lịch đếm chim',
}

type ActivityFilterKey = 'ALL' | 'THRESHOLDS' | 'VERDICTS' | 'REVIEWS' | 'PROPOSALS'

const FILTER_CHIPS: { key: ActivityFilterKey; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'THRESHOLDS', label: 'Nhiệt ẩm' },
  { key: 'VERDICTS', label: 'Cảnh báo' },
  { key: 'REVIEWS', label: 'Chủ nhà' },
  { key: 'PROPOSALS', label: 'Đề xuất AI' },
]

/**
 * [S13] Màn hình Nhật ký hoạt động & Phán quyết của Chuyên gia (EXPERT-FR-009, BZ-14)
 * Đồng bộ 100% quy chuẩn thẩm mỹ Calm Industrial (Card phẳng không viền + ChoiceChips) với nhánh FARM_OWNER.
 */
export default function ExpertActivityScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const router = useRouter()
  const selectedFarmId = useExpertScopeStore(state => state.selectedFarmId)

  const [activeFilter, setActiveFilter] = useState<ActivityFilterKey>('ALL')

  const {
    data: activityResponse,
    isLoading,
    isRefetching,
    refetch,
  } = useExpertActivity(selectedFarmId || '')

  const activities = useMemo<ExpertActivityEntry[]>(() => {
    return activityResponse?.data || []
  }, [activityResponse?.data])

  const filteredActivities = useMemo(() => {
    if (activeFilter === 'ALL') return activities
    if (activeFilter === 'THRESHOLDS') {
      return activities.filter(a =>
        a.action === 'THRESHOLD_UPDATED' ||
        a.action === 'THRESHOLD_RESET' ||
        a.action === 'FUZZY_UPDATED' ||
        a.action === 'DETECTION_TUNING_UPDATED'
      )
    }
    if (activeFilter === 'VERDICTS') {
      return activities.filter(a => a.action === 'ALERT_VERDICT_SET')
    }
    if (activeFilter === 'REVIEWS') {
      return activities.filter(a =>
        a.action === 'REVIEW_ACCEPTED' ||
        a.action === 'REVIEW_REVERTED' ||
        a.action === 'REVIEW_ADJUSTED'
      )
    }
    if (activeFilter === 'PROPOSALS') {
      return activities.filter(a =>
        a.action === 'PROPOSAL_APPROVED' ||
        a.action === 'PROPOSAL_REJECTED'
      )
    }
    return activities
  }, [activities, activeFilter])

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Nhật ký xử lý kỹ thuật')} onBack={() => router.back()} />

      {/* Hàng Filter Chips bo tròn không viền chuẩn ChoiceChips của FARM_OWNER */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {FILTER_CHIPS.map(chip => {
            const isSelected = activeFilter === chip.key
            return (
              <Pressable
                key={chip.key}
                hitSlop={8}
                onPress={() => setActiveFilter(chip.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? palette.inverse : palette.surface,
                  },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  variant="body"
                  weight="semiBold"
                  color={isSelected ? palette.onInverse : palette.text}
                >
                  {t(chip.label)}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <Skeleton width="100%" height={96} radius={Radius.lg} />
          <View style={{ height: Spacing.sm }} />
          <Skeleton width="100%" height={96} radius={Radius.lg} />
          <View style={{ height: Spacing.sm }} />
          <Skeleton width="100%" height={96} radius={Radius.lg} />
        </View>
      ) : filteredActivities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            message={
              activeFilter === 'ALL'
                ? t('Chưa có lịch sử hoạt động chuyên gia nào trên trang trại này.')
                : t('Không có hoạt động nào trong mục đã chọn.')
            }
          />
        </View>
      ) : (
        <FlatList
          data={filteredActivities}
          keyExtractor={item => item._id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: TAB_BAR_OVERLAP + Spacing.xxl * 3 },
          ]}
          renderItem={({ item }) => {
            const actionText = ACTION_LABELS[item.action] || t('Thao tác chuyên gia')
            const actorName = item.actor?.full_name || t('Chuyên gia')
            const dateStr = formatDateTime(item.created_at)

            const isExpert = item.actor_role === 'DOMAIN_EXPERT'

            return (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.titleRow}>
                    <SlidersHorizontal size={16} color={palette.text} weight="bold" />
                    <Text variant="body" weight="semiBold" style={styles.actionTitle}>
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

                <View style={styles.badgeRow}>
                  <SplitBadge
                    left={isExpert ? t('Chuyên gia') : t('Chủ trại')}
                    right={actorName}
                    color={isExpert ? palette.primary : palette.surfaceStrong}
                    textColor={isExpert ? palette.onPrimary : palette.text}
                    innerColor={isExpert ? palette.onPrimary : palette.surface}
                    innerTextColor={isExpert ? palette.primary : palette.textSecondary}
                  />
                  {item.target_type && (
                    <Text variant="small" color={palette.textSecondary}>
                      {item.target_type} {item.target_id ? `#${item.target_id.slice(-6)}` : ''}
                    </Text>
                  )}
                </View>
              </Card>
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
  chipsWrapper: {
    paddingVertical: Spacing.sm,
  },
  chipsContainer: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  skeletonContainer: {
    padding: Spacing.md,
  },
  emptyContainer: {
    padding: Spacing.md,
  },
  listContent: {
    padding: Spacing.md,
    paddingTop: Spacing.xs,
    gap: Spacing.sm,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
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
    flex: 1,
  },
  actionTitle: {
    flexShrink: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
})
