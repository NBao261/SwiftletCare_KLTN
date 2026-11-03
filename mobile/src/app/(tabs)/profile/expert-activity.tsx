import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router } from 'expo-router'
import { ArrowsClockwiseIcon, CheckCircleIcon, ClockIcon, GavelIcon, PencilSimpleIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { MockDataBadge } from '@/components/common/MockDataBadge'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { IS_MOCK_API_ENABLED } from '@/constants/mockApi'
import { Radius, Spacing } from '@/constants/theme'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { useExpertDecisions } from '@/hooks/profile/useExpertDecisions'
import { useMyReviewItems } from '@/hooks/profile/useMyReviewItems'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { ExpertDecision, ReviewItem } from '@/types'
import { getDecisionTypeLabel, getReviewStatusLabel, isReviewPending } from '@/utils/account.utils'
import { formatDateTime } from '@/utils/date.utils'
import { getRoleLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

type ActivityTab = 'decisions' | 'reviews'

// Nơi áp dụng quyết định: nhà · khu vực
function getScopeText(houseName?: string, zoneName?: string): string {
  return [houseName, zoneName].filter(Boolean).join(' · ')
}

// Nội dung một quyết định: giá trị cũ → mới, hoặc phán quyết
function getDecisionDetail(decision: ExpertDecision): string {
  if (decision.verdict) return decision.verdict === 'CONFIRMED' ? t('Xác nhận đúng') : t('Bác bỏ')
  if (decision.old_value && decision.new_value) return `${decision.old_value} → ${decision.new_value}`
  return ''
}

/**
 * Hoạt động chuyên gia trên farm: quyết định của chuyên gia mà chủ trại được báo (EXPERT-FR-009) và thay đổi của chủ trại
 * đang chờ chuyên gia duyệt (EXPERT-FR-010/011). Backend chưa có route — toàn bộ là dữ liệu mẫu, có nhãn
 */
export default function ExpertActivityScreen() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const { farm } = useCurrentFarm()
  const [tab, setTab] = useState<ActivityTab>('decisions')
  const decisionsQuery = useExpertDecisions(farm?._id ?? '')
  const reviewsQuery = useMyReviewItems(farm?._id ?? '')

  if (!canPerform(user, 'viewOwnerProfile')) return <Redirect href="/(tabs)/profile" />

  const renderDecision = (decision: ExpertDecision, index: number, total: number) => (
    <ProfileRow
      key={decision._id}
      icon={decision.type === 'ALERT_VERDICT' ? GavelIcon : PencilSimpleIcon}
      label={getDecisionTypeLabel(decision.type)}
      caption={[
        `${decision.actor_name} (${getRoleLabel(decision.actor_role)}) · ${formatDateTime(decision.created_at)}`,
        getScopeText(decision.house_name, decision.zone_name),
        getDecisionDetail(decision),
      ]
        .filter(Boolean)
        .join('\n')}
      hasDivider={index < total - 1}
    />
  )

  const renderReview = (item: ReviewItem, index: number, total: number) => (
    <ProfileRow
      key={item._id}
      icon={isReviewPending(item.status) ? ClockIcon : item.status === 'REVERTED' ? ArrowsClockwiseIcon : CheckCircleIcon}
      label={item.kind === 'CHANGE_REVIEW' ? t('Thay đổi ngưỡng, hệ số của bạn') : t('Gợi ý hệ số bạn đã gửi')}
      value={getReviewStatusLabel(item.status)}
      caption={[getScopeText(item.house_name, item.zone_name), `${item.old_value} → ${item.new_value}`, formatDateTime(item.created_at)]
        .filter(Boolean)
        .join('\n')}
      hasDivider={index < total - 1}
    />
  )

  const renderList = () => {
    if (!IS_MOCK_API_ENABLED) return <EmptyState message={t('Hoạt động chuyên gia: Sắp có')} />
    const query = tab === 'decisions' ? decisionsQuery : reviewsQuery
    if (query.isLoading) return <Skeleton width="100%" height={160} radius={Radius.lg} />
    if (query.isError) return <EmptyState message={t('Không tải được hoạt động chuyên gia')} actionLabel={t('Thử lại')} onAction={() => query.refetch()} />
    if (tab === 'decisions') {
      const decisions = decisionsQuery.data ?? []
      if (decisions.length === 0) return <EmptyState message={t('Chưa có quyết định nào của chuyên gia')} />
      return <Card style={styles.listCard}>{decisions.map((decision, index) => renderDecision(decision, index, decisions.length))}</Card>
    }
    const items = reviewsQuery.data ?? []
    if (items.length === 0) return <EmptyState message={t('Không có thay đổi nào chờ chuyên gia')} />
    return <Card style={styles.listCard}>{items.map((item, index) => renderReview(item, index, items.length))}</Card>
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Hoạt động chuyên gia')} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + TAB_BAR_OVERLAP }]}
      >
        <View style={styles.intro}>
          {IS_MOCK_API_ENABLED && <MockDataBadge />}
          <Text variant="small" color={palette.textSecondary}>
            {t('Mọi quyết định của chuyên gia trên {farm} và các thay đổi của bạn đang chờ chuyên gia duyệt.', {
              farm: farm?.name ?? '_',
            })}
          </Text>
        </View>
        <ChoiceChips<ActivityTab>
          options={[
            { id: 'decisions', label: t('Quyết định của chuyên gia') },
            { id: 'reviews', label: t('Chờ duyệt') },
          ]}
          selectedId={tab}
          onSelect={setTab}
          accessibilityLabel={t('Chọn danh sách')}
        />
        {renderList()}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  intro: { gap: Spacing.sm },
  listCard: { paddingVertical: Spacing.xs },
})
