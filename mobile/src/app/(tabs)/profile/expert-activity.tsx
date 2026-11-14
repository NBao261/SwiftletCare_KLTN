import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { ArrowsClockwiseIcon, CheckCircleIcon, ClockIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { ExpertDecisionList } from '@/components/profile/ExpertDecisionList'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useParameterReviewList } from '@/hooks/expert-activity/useParameterReviewList'
import { useProposalList } from '@/hooks/expert-activity/useProposalList'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { ChangeReviewStatus, ProposalStatus } from '@/types'
import { describeValueDiff, getReviewStatusLabel, isReviewPending } from '@/utils/account.utils'
import { formatDateTime } from '@/utils/date.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

type ActivityTab = 'decisions' | 'reviews'

const LIST_SKELETON_HEIGHT = 160

// Biểu tượng theo trạng thái mục chờ duyệt / đề xuất
function getStatusIcon(status: ChangeReviewStatus | ProposalStatus) {
  if (isReviewPending(status)) return ClockIcon
  return status === 'REVERTED' || status === 'REJECTED' ? ArrowsClockwiseIcon : CheckCircleIcon
}

/**
 * Hoạt động chuyên gia trên farm: lịch sử quyết định (EXPERT-FR-009, GET /expert-activity — gồm cả quyết định chủ trại
 * làm thay khi farm chưa có chuyên gia, BR-22), thay đổi của chủ trại chờ chuyên gia duyệt (EXPERT-FR-010) và gợi ý hệ số
 * đã gửi (EXPERT-FR-011). Mỗi danh sách tải theo trang (meta)
 */
export default function ExpertActivityScreen() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const { farm } = useCurrentFarm()
  const farmId = farm?._id ?? ''
  const [tab, setTab] = useState<ActivityTab>('decisions')
  const directory = useZoneDirectory()
  const reviewsQuery = useParameterReviewList(farmId, tab === 'reviews')
  const proposalsQuery = useProposalList(farmId, tab === 'reviews')

  if (!canPerform(user, 'viewOwnerProfile')) return <Redirect href="/(tabs)/profile" />

  // Nơi áp dụng: nhà › khu vực, tra tên từ danh sách đã tải; không có thì bỏ
  const getScopeText = (zoneId?: string | null, houseId?: string | null): string => {
    const zone = zoneId ? directory.zoneById.get(zoneId) : undefined
    const house = directory.houseById.get(houseId ?? zone?.house_id ?? '')
    return [house?.name, zone?.name].filter(Boolean).join(' › ')
  }

  const renderReviews = () => {
    if (reviewsQuery.isLoading || proposalsQuery.isLoading) {
      return <Skeleton width="100%" height={LIST_SKELETON_HEIGHT} radius={Radius.lg} />
    }
    if (reviewsQuery.isError || proposalsQuery.isError) {
      return (
        <EmptyState
          message={t('Không tải được hoạt động chuyên gia')}
          actionLabel={t('Thử lại')}
          onAction={() => {
            void reviewsQuery.refetch()
            void proposalsQuery.refetch()
          }}
        />
      )
    }
    const reviews = reviewsQuery.data?.pages.flatMap(page => page.data) ?? []
    const proposals = proposalsQuery.data?.pages.flatMap(page => page.data) ?? []
    if (reviews.length === 0 && proposals.length === 0) {
      return <EmptyState message={t('Không có thay đổi nào chờ chuyên gia')} />
    }
    return (
      <>
        {reviews.length > 0 && (
          <View style={styles.group}>
            <Text variant="body" weight="semiBold">
              {t('Thay đổi ngưỡng, hệ số của bạn')}
            </Text>
            <Card style={styles.listCard}>
              {reviews.map((review, index) => (
                <ProfileRow
                  key={review._id}
                  icon={getStatusIcon(review.status)}
                  label={review.group === 'thresholds' ? t('Ngưỡng') : t('Hệ số điều khiển')}
                  value={getReviewStatusLabel(review.status)}
                  caption={[getScopeText(review.zone_id), formatDateTime(review.updated_at)].filter(Boolean).join('\n')}
                  details={describeValueDiff(review.old_values, review.new_values)}
                  hasDivider={index < reviews.length - 1}
                />
              ))}
            </Card>
            {reviewsQuery.hasNextPage && (
              <Button
                label={t('Xem thêm')}
                variant="link"
                loading={reviewsQuery.isFetchingNextPage}
                onPress={() => reviewsQuery.fetchNextPage()}
              />
            )}
          </View>
        )}
        {proposals.length > 0 && (
          <View style={styles.group}>
            <Text variant="body" weight="semiBold">
              {t('Gợi ý hệ số bạn đã gửi')}
            </Text>
            <Card style={styles.listCard}>
              {proposals.map((proposal, index) => (
                <ProfileRow
                  key={proposal._id}
                  icon={getStatusIcon(proposal.status)}
                  label={getScopeText(proposal.zone_id) || t('Gợi ý hệ số')}
                  value={getReviewStatusLabel(proposal.status)}
                  caption={formatDateTime(proposal.created_at)}
                  details={[
                    ...describeValueDiff(proposal.current_values, proposal.suggested_values),
                    ...(proposal.note ? [t('Lý do: {note}', { note: proposal.note })] : []),
                  ]}
                  hasDivider={index < proposals.length - 1}
                />
              ))}
            </Card>
            {proposalsQuery.hasNextPage && (
              <Button
                label={t('Xem thêm')}
                variant="link"
                loading={proposalsQuery.isFetchingNextPage}
                onPress={() => proposalsQuery.fetchNextPage()}
              />
            )}
          </View>
        )}
      </>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Hoạt động chuyên gia')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + TAB_BAR_OVERLAP }]}
      >
        <Text variant="small" color={palette.textSecondary}>
          {t('Mọi quyết định của chuyên gia trên {farm} và các thay đổi của bạn đang chờ chuyên gia duyệt.', {
            farm: farm?.name ?? '_',
          })}
        </Text>
        <ChoiceChips<ActivityTab>
          options={[
            { id: 'decisions', label: t('Quyết định của chuyên gia') },
            { id: 'reviews', label: t('Chờ duyệt') },
          ]}
          selectedId={tab}
          onSelect={setTab}
          accessibilityLabel={t('Chọn danh sách')}
        />
        {!farm ? <EmptyState message={t('Chưa có farm')} /> : tab === 'decisions' ? (
          <ExpertDecisionList farmId={farmId} enabled />
        ) : (
          renderReviews()
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  group: { gap: Spacing.sm },
  listCard: { paddingVertical: Spacing.xs },
})
