import { useState } from 'react'
import { Alert as NativeAlert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { ReasonSheet } from '@/components/common/ReasonSheet'
import { HeaderPicker } from '@/components/farm/HeaderPicker'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { AppHeader } from '@/components/layout/AppHeader'
import { RecommendationRow } from '@/components/recommendation/RecommendationRow'
import { RecommendationSheet } from '@/components/recommendation/RecommendationSheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { Radius, Spacing } from '@/constants/theme'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useGoBackOrHome } from '@/hooks/navigation/useGoBackOrHome'
import { useAcceptRecommendation } from '@/hooks/recommendation/useAcceptRecommendation'
import { useRecommendations } from '@/hooks/recommendation/useRecommendations'
import { useRejectRecommendation } from '@/hooks/recommendation/useRejectRecommendation'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useAuthStore } from '@/stores/authStore'
import type { Recommendation, RecommendationStatus } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { canPerform } from '@/utils/permission.utils'
import { describeRecommendationAction, getRecommendationAction } from '@/utils/recommendation.utils'
import { t } from '@/utils/i18n.utils'

// Bộ lọc: mỗi chip một trạng thái, vì GET /recommendations nhận một status và danh sách phân trang ở server
type RecommendationFilter = 'open' | 'accepted' | 'measured' | 'rejected' | 'expired'
const FILTER_STATUSES: Record<RecommendationFilter, RecommendationStatus> = {
  open: 'OPEN',
  accepted: 'ACCEPTED',
  measured: 'MEASURED',
  rejected: 'REJECTED',
  expired: 'EXPIRED',
}
const SKELETON_ROWS = 3
const ROW_SKELETON_HEIGHT = 72

// Câu lỗi khi quyết định: 409 là khuyến nghị vừa hết hạn hoặc đã được quyết định (danh sách đã tải lại)
function getDecisionErrorMessage(error: unknown): string {
  return getSettingsErrorMessage(error, {
    409: t('Khuyến nghị không còn chờ quyết định (đã quyết định hoặc đã hết hạn)'),
    400: t('Nhà chưa có khu vực, hoặc giá trị mới không hợp với ngưỡng hiện tại của một khu vực'),
  })
}

/** Khuyến nghị của các nhà (MF-08, EXPERT-FR-017…019): luật của chuyên gia thoả trên dữ liệu của nhà thì mở một khuyến nghị; chủ
 * trại chấp nhận (mở phiếu công việc hoặc đổi tham số mọi khu vực của nhà) hoặc từ chối kèm lý do; chuyên gia chỉ xem.
 * Khuyến nghị đang mở hết hạn sau 7 ngày. Xem theo một farm (thuộc từ 2 farm thì đổi ở tiêu đề), tải thêm theo trang. Màn riêng ở
 * stack gốc, mở từ khối "Khuyến nghị" ở Trang chủ */
export default function RecommendationsScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const goBack = useGoBackOrHome()
  const toast = useToastMessage()
  const user = useAuthStore(state => state.user)
  const canView = canPerform(user, 'viewRecommendations')
  const canDecide = canPerform(user, 'decideRecommendation')
  const [filter, setFilter] = useState<RecommendationFilter>('open')
  const [selected, setSelected] = useState<Recommendation | null>(null)
  // Sheet nhập lý do từ chối: key mới mỗi lần mở để ô nhập trống
  const [rejectTarget, setRejectTarget] = useState<{ recommendation: Recommendation; key: number } | null>(null)
  const [isRefreshing, setRefreshing] = useState(false)
  const { houseById } = useZoneDirectory()
  // Farm đang xem: chọn trên màn → farm truyền từ khối ở Trang chủ → farm đang xem ở tab Trang trại → farm đầu tiên
  const params = useLocalSearchParams<{ farmId?: string }>()
  const [pickedFarmId, setPickedFarmId] = useState<string | undefined>(params.farmId)
  const [isFarmSheetOpen, setFarmSheetOpen] = useState(false)
  const farmQuery = useCurrentFarm(pickedFarmId)
  const farm = farmQuery.farm
  const recommendationsQuery = useRecommendations(farm?._id ?? '', FILTER_STATUSES[filter], canView)
  const acceptRecommendation = useAcceptRecommendation()
  const rejectRecommendation = useRejectRecommendation()
  const recommendations = recommendationsQuery.data?.pages.flatMap(page => page.data) ?? []

  if (!canView) return <Redirect href="/(tabs)/home" />

  const houseNameOf = (recommendation: Recommendation) => houseById.get(recommendation.house_id)?.name ?? '_'

  // Chưa có farm thì query khuyến nghị đang tắt (refetch() bỏ qua enabled, gọi farmId rỗng sẽ nhận 422), nên thử lại danh sách farm
  const retry = () => (farm ? recommendationsQuery.refetch() : farmQuery.refetch())

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await retry()
    } finally {
      setRefreshing(false)
    }
  }

  // Chấp nhận: hỏi lại, nói rõ việc sẽ xảy ra
  const accept = () => {
    if (!selected) return
    const target = selected
    NativeAlert.alert(
      t('Chấp nhận khuyến nghị?'),
      describeRecommendationAction(getRecommendationAction(target)),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Chấp nhận'),
          onPress: () =>
            acceptRecommendation.mutate(target._id, {
              onSuccess: () => {
                setSelected(null)
                toast.show(
                  getRecommendationAction(target)?.type === 'WORK_ORDER'
                    ? t('Đã chấp nhận, đã mở phiếu công việc')
                    : t('Đã chấp nhận, tham số của nhà đã được đổi'),
                )
              },
            }),
        },
      ],
    )
  }

  // Từ chối: đóng sheet chi tiết rồi mở sheet nhập lý do (không chồng hai bảng lên nhau)
  const openReject = () => {
    if (!selected) return
    // Bỏ lỗi của lần từ chối trước để sheet mới không hiện dòng lỗi cũ
    rejectRecommendation.reset()
    setRejectTarget(current => ({ recommendation: selected, key: (current?.key ?? 0) + 1 }))
    setSelected(null)
  }

  const submitReject = (reason: string) => {
    if (!rejectTarget) return
    rejectRecommendation.mutate(
      { recommendationId: rejectTarget.recommendation._id, reason },
      {
        onSuccess: () => {
          setRejectTarget(null)
          toast.show(t('Đã từ chối khuyến nghị'))
        },
      },
    )
  }

  const renderList = () => {
    if (recommendationsQuery.isLoading || farmQuery.isLoading) {
      return Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton
          key={index}
          width="100%"
          height={ROW_SKELETON_HEIGHT}
          radius={Radius.md}
          color={palette.surfaceStrong}
          delayMs={index * 75}
        />
      ))
    }
    if (recommendationsQuery.isError || farmQuery.isError) {
      return (
        <EmptyState
          message={t('Không tải được khuyến nghị')}
          actionLabel={t('Thử lại')}
          onAction={retry}
        />
      )
    }
    if (recommendations.length === 0) {
      return (
        <Text variant="small" color={palette.textSecondary}>
          {filter === 'open' ? t('Không có khuyến nghị nào chờ quyết định') : t('Chưa có khuyến nghị nào')}
        </Text>
      )
    }
    return recommendations.map((recommendation, index) => (
      <RecommendationRow
        key={recommendation._id}
        recommendation={recommendation}
        houseName={houseNameOf(recommendation)}
        hasDivider={index < recommendations.length - 1}
        onPress={() => {
          acceptRecommendation.reset()
          setSelected(recommendation)
        }}
      />
    ))
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View key={language} style={styles.screen}>
        {/* Thuộc từ 2 farm thì tiêu đề kèm tên farm và bấm để đổi farm */}
        {farmQuery.hasMultipleFarms && farm ? (
          <AppHeader
            onBack={goBack}
            leading={
              <HeaderPicker
                title={`${t('Khuyến nghị')} · ${farm.name}`}
                onPress={() => setFarmSheetOpen(true)}
                accessibilityLabel={t('{farm}, bấm để đổi trang trại', { farm: farm.name })}
              />
            }
          />
        ) : (
          <AppHeader title={t('Khuyến nghị')} onBack={goBack} />
        )}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={palette.textSecondary}
              colors={[palette.text]}
            />
          }
        >
          <ChoiceChips
            options={[
              { id: 'open', label: t('Chờ quyết định') },
              { id: 'accepted', label: t('Đã chấp nhận') },
              { id: 'measured', label: t('Đã đo hiệu quả') },
              { id: 'rejected', label: t('Đã từ chối') },
              { id: 'expired', label: t('Hết hạn') },
            ]}
            selectedId={filter}
            onSelect={setFilter}
            accessibilityLabel={t('Lọc khuyến nghị')}
          />
          <Card>{renderList()}</Card>
          {recommendationsQuery.hasNextPage && (
            <Button
              variant="link"
              label={t('Xem thêm')}
              onPress={() => recommendationsQuery.fetchNextPage()}
              loading={recommendationsQuery.isFetchingNextPage}
              style={styles.more}
            />
          )}
          <Text variant="small" color={palette.textSecondary}>
            {t(
              'Khuyến nghị mở khi luật của chuyên gia thoả trên dữ liệu của nhà. Chấp nhận thì hệ thống mở phiếu công việc hoặc đổi tham số mọi khu vực của nhà, và đo hiệu quả sau 7 ngày. Khuyến nghị chờ quá 7 ngày thì hết hạn.',
            )}
          </Text>
        </ScrollView>
      </View>
      <RecommendationSheet
        recommendation={selected}
        houseName={selected ? houseNameOf(selected) : '_'}
        canDecide={canDecide}
        isAccepting={acceptRecommendation.isPending}
        error={acceptRecommendation.error ? getDecisionErrorMessage(acceptRecommendation.error) : null}
        onAccept={accept}
        onReject={openReject}
        onOpenWorkOrder={workOrderId => {
          setSelected(null)
          router.push({ pathname: '/work-orders/[workOrderId]', params: { workOrderId } })
        }}
        onClose={() => setSelected(null)}
      />
      <OptionSheet
        visible={isFarmSheetOpen}
        title={t('Chọn trang trại')}
        options={farmQuery.farms.map(item => ({ id: item._id, label: item.name }))}
        selectedId={farm?._id}
        onSelect={farmId => {
          setFarmSheetOpen(false)
          setPickedFarmId(farmId)
        }}
        onClose={() => setFarmSheetOpen(false)}
      />
      {rejectTarget && (
        <ReasonSheet
          key={rejectTarget.key}
          visible
          title={t('Từ chối khuyến nghị')}
          description={t('Ghi lý do để chuyên gia xem lại luật.')}
          placeholder={t('Lý do từ chối')}
          submitLabel={t('Từ chối')}
          isSubmitting={rejectRecommendation.isPending}
          error={rejectRecommendation.error ? getDecisionErrorMessage(rejectRecommendation.error) : null}
          onSubmit={submitReject}
          onClose={() => setRejectTarget(null)}
        />
      )}
      {toast.message && <Toast message={toast.message} bottomOffset={insets.bottom + Spacing.lg} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
  more: { alignSelf: 'center' },
})
