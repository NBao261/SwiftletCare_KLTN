import React, { useMemo, useRef } from 'react'
import {
  LayoutChangeEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import {
  ArrowRight,
  CalendarCheck,
  ClipboardText,
  Clock,
  ClockCounterClockwise,
  MapPin,
  SlidersHorizontal,
  WarningCircle,
} from 'phosphor-react-native'
import { QueueDayRatingCard } from '@/components/expert/queue/QueueDayRatingCard'
import { QueueProposalCard } from '@/components/expert/queue/QueueProposalCard'
import { QueueReportCard } from '@/components/expert/queue/QueueReportCard'
import { QueueReviewCard } from '@/components/expert/queue/QueueReviewCard'
import { AppHeader } from '@/components/layout/AppHeader'
import { PersistentScopeBar } from '@/components/layout/PersistentScopeBar'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Skeleton } from '@/components/ui/skeleton'
import { SplitBadge } from '@/components/ui/split-badge'
import { Text } from '@/components/ui/text'
import { FontFamily, Radius, Spacing } from '@/constants/theme'
import { useInferredAlerts } from '@/hooks/expert/useInferredAlerts'
import {
  useHealthReports,
  useSetReportConclusion,
  useSubmitDayRating,
} from '@/hooks/expert/useExpertReports'
import {
  useExpertProposals,
  useExpertReviewItems,
  useTakeProposalAction,
  useTakeReviewAction,
} from '@/hooks/expert/useExpertReviews'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import type { DailyHealthStatus, DayRating, InferredAlert, ReviewItem, CoefficientProposal, ZoneHealthReportItem } from '@/types'
import { formatTimeAgo } from '@/utils/date.utils'
import { getInferredAlertDescription, getInferredAlertLabel } from '@/utils/inferredAlert.utils'
import { t } from '@/utils/i18n.utils'

interface QueueInferredAlertCardProps {
  alert: InferredAlert
}

/**
 * Thẻ Cảnh báo suy luận AI khẩn cấp P0 trong Hàng đợi (EXPERT-FR-003, ALERT-FR-014).
 * Chuẩn hóa bằng <Card> và <PressableScale> theo design system FARM_OWNER.
 * Chạm [Thẩm định ngay →] chuyển thẳng sang tab Thẩm định với alertId chọn sẵn đúng 1 chạm.
 */
function QueueInferredAlertCard({ alert }: QueueInferredAlertCardProps) {
  const palette = usePalette()
  const router = useRouter()

  const alertTitle = getInferredAlertLabel(alert.type)
  const alertDesc = alert.message || getInferredAlertDescription(alert.type)
  const timeStr = formatTimeAgo(alert.created_at)

  const handleInspect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    router.push({
      pathname: '/(tabs)/verdicts',
      params: { alertId: alert._id },
    })
  }

  return (
    <Card
      style={[
        styles.alertCard,
        {
          borderColor: palette.border,
          borderLeftColor: palette.alert,
          borderLeftWidth: 4,
        },
      ]}
    >
      {/* Hàng 1: SplitBadge mức độ & Thời gian tương đối */}
      <View style={styles.alertTopRow}>
        <SplitBadge
          left="P0"
          right={t('KHẨN CẤP')}
          color={palette.alert}
          textColor={palette.onInverse}
          innerColor={palette.onInverse}
          innerTextColor={palette.alert}
        />

        <View style={styles.alertTimeWrapper}>
          <Clock size={12} color={palette.textSecondary} />
          <Text variant="small" color={palette.textSecondary}>
            {timeStr}
          </Text>
        </View>
      </View>

      {/* Hàng 2: Tên sự cố & Vị trí Zone */}
      <View style={styles.alertTitleRow}>
        <Text variant="heading" weight="bold">
          {alertTitle}
        </Text>
        <View style={styles.alertLocationWrapper}>
          <MapPin size={13} color={palette.textSecondary} />
          <Text variant="small" color={palette.textSecondary}>
            {alert.zone_id ? t('Tầng / Zone') : t('Toàn nhà')}
          </Text>
        </View>
      </View>

      {/* Hàng 3: Tóm tắt viễn trắc */}
      <Text variant="body" color={palette.text} numberOfLines={2} style={styles.alertDescription}>
        {alertDesc}
      </Text>

      {/* Hàng 4: Nút hành động 1 chạm [Thẩm định ngay →] */}
      <PressableScale
        onPress={handleInspect}
        style={[
          styles.alertActionButton,
          {
            backgroundColor: palette.text,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('Thẩm định ngay sự cố này')}
      >
        <Text variant="body" weight="bold" color={palette.onInverse}>
          {t('Thẩm định ngay')}
        </Text>
        <ArrowRight size={16} weight="bold" color={palette.onInverse} />
      </PressableScale>
    </Card>
  )
}

/**
 * [PHẦN 1] MOBILE — MENU HÀNG ĐỢI (src/app/(tabs)/queue/index.tsx)
 * Kiến trúc 1 màn hình duy nhất (One-Screen Consolidated) cho Domain Expert.
 * Xử lý tại chỗ 5 nhóm công việc:
 * - Khối 1: PersistentScopeBar ghim cố định đầu trang (Zustand v5 + MMKV)
 * - Khối 2: Lưới 2x2 gồm 4 Thẻ KPI Phản Xạ Nhanh — chạm để cuộn mượt xuống khối tương ứng
 * - Khối 3: Cảnh báo suy luận P0 (EXPERT-FR-003, ALERT-FR-014) -> [Thẩm định ngay →]
 * - Khối 4: Review thay đổi của Chủ trại (EXPERT-FR-010) -> [Chấp thuận] [Hoàn nguyên] [Hiệu chỉnh]
 * - Khối 5: Duyệt đề xuất hệ số mờ Fuzzy (EXPERT-FR-011) -> [Duyệt áp dụng] [Từ chối...]
 * - Khối 6: Đánh giá ngày độc lập BR-31 (EXPERT-FR-012) -> [Tốt] [Theo dõi] [Cần xử lý] [Bỏ qua]
 * - Khối 7: Báo cáo sức khỏe & Kết luận (EXPERT-FR-005, 006, 013) -> [PDF / CSV] & [Viết kết luận]
 */
export default function QueueScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const router = useRouter()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const sectionYPositions = useRef<Record<string, number>>({})

  // Phạm vi giám sát dùng chung (PersistentScopeBar)
  const selectedFarmId = useExpertScopeStore(state => state.selectedFarmId)
  const selectedHouseId = useExpertScopeStore(state => state.selectedHouseId)
  const selectedZoneId = useExpertScopeStore(state => state.selectedZoneId)

  // ── Khối 3: Cảnh báo suy luận AI khẩn cấp P0 (EXPERT-FR-003, ALERT-FR-014) ──
  const {
    data: alertsResponse,
    isLoading: isAlertsLoading,
    isRefetching: isAlertsRefetching,
    refetch: refetchAlerts,
  } = useInferredAlerts({
    farm_id: selectedFarmId || undefined,
    zone_id: selectedZoneId || undefined,
  })

  // ── Khối 4: Review thay đổi của Chủ trại (EXPERT-FR-010) ──
  const {
    data: reviewsResponse,
    isLoading: isReviewsLoading,
    isRefetching: isReviewsRefetching,
    refetch: refetchReviews,
  } = useExpertReviewItems({
    farm_id: selectedFarmId || undefined,
    status: 'PENDING_REVIEW',
  })
  const takeReviewAction = useTakeReviewAction()

  // ── Khối 5: Duyệt đề xuất hệ số Fuzzy (EXPERT-FR-011) ──
  const {
    data: proposalsResponse,
    isLoading: isProposalsLoading,
    isRefetching: isProposalsRefetching,
    refetch: refetchProposals,
  } = useExpertProposals({
    farm_id: selectedFarmId || undefined,
    status: 'PROPOSED',
  })
  const takeProposalAction = useTakeProposalAction()

  // ── Khối 7: Báo cáo sức khỏe định kỳ & Kết luận (EXPERT-FR-005, 006, 013) ──
  const {
    data: reportsResponse,
    isLoading: isReportsLoading,
    isRefetching: isReportsRefetching,
    refetch: refetchReports,
  } = useHealthReports({
    farm_id: selectedFarmId || undefined,
    zone_id: selectedZoneId || undefined,
  })
  const setReportConclusion = useSetReportConclusion()

  // ── Khối 6: Đánh giá ngày độc lập 2 bước (EXPERT-FR-012, BR-31) ──
  const submitDayRating = useSubmitDayRating()

  // Lọc dữ liệu hàng đợi
  const pendingInferredAlerts = useMemo<InferredAlert[]>(() => {
    const list = alertsResponse?.data || []
    return list.filter(a => !a.expert_verdict)
  }, [alertsResponse])

  const pendingReviewItems = useMemo<ReviewItem[]>(() => {
    return reviewsResponse?.data || []
  }, [reviewsResponse])

  const pendingProposals = useMemo<CoefficientProposal[]>(() => {
    return proposalsResponse?.data || []
  }, [proposalsResponse])

  const pendingReports = useMemo<ZoneHealthReportItem[]>(() => {
    const list = reportsResponse?.data || []
    const unfinalized = list.filter(r => !r.expert_conclusion)
    // Nếu tất cả đã có kết luận, hiển thị báo cáo gần nhất để chuyên gia vẫn có thể tải PDF/CSV
    return unfinalized.length > 0 ? unfinalized : list.slice(0, 1)
  }, [reportsResponse])

  // Ngày đánh giá độc lập mẫu hôm qua tuân thủ BR-31
  const yesterday = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }, [])

  const samplePendingRatings = useMemo<DayRating[]>(() => {
    const houseId = selectedHouseId || 'house-default-01'
    return [
      {
        _id: `rating-${houseId}-${yesterday}`,
        house_id: houseId,
        date: yesterday,
        state: 'PENDING',
        system_status: 'WATCH',
        system_reasons: [
          'Độ ẩm dưới ngưỡng 70% liên tục 45 phút (14:30 - 15:15)',
          'Nhiệt độ đạt đỉnh 32.4°C lúc 15:00',
        ],
      },
    ]
  }, [selectedHouseId, yesterday])

  // Tính số liệu cho 4 thẻ KPI phản xạ nhanh
  const kpiAlertsCount = pendingInferredAlerts.length
  const kpiReviewsCount = pendingReviewItems.length
  const kpiProposalsCount = pendingProposals.length
  const kpiRatingsAndReportsCount = samplePendingRatings.length + pendingReports.length

  const isRefreshing =
    isAlertsRefetching || isReviewsRefetching || isProposalsRefetching || isReportsRefetching

  const handleRefreshAll = () => {
    refetchAlerts()
    refetchReviews()
    refetchProposals()
    refetchReports()
  }

  // Ghi nhận vị trí Y từng khối để cuộn mượt 1 chạm
  const handleSectionLayout = (key: string, event: LayoutChangeEvent) => {
    sectionYPositions.current[key] = event.nativeEvent.layout.y
  }

  const scrollToSection = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    const targetY = sectionYPositions.current[key]
    if (targetY != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, targetY - 12), animated: true })
    }
  }

  // Xử lý hành động Review chủ trại (Khối 4)
  const handleAcceptReview = async (itemId: string) => {
    await takeReviewAction.mutateAsync({ itemId, action: 'ACCEPT' })
  }

  const handleRevertReview = async (itemId: string) => {
    await takeReviewAction.mutateAsync({ itemId, action: 'REVERT' })
  }

  // Xử lý phê duyệt đề xuất Fuzzy (Khối 5)
  const handleApproveProposal = async (proposalId: string) => {
    await takeProposalAction.mutateAsync({ proposalId, action: 'APPROVE' })
  }

  const handleRejectProposal = async (proposalId: string, reason: string) => {
    await takeProposalAction.mutateAsync({
      proposalId,
      action: 'REJECT',
      rejectionReason: reason,
    })
  }

  // Xử lý nộp đánh giá ngày độc lập BR-31 (Khối 6)
  const handleSubmitDayRating = async (
    houseId: string,
    date: string,
    status: DailyHealthStatus,
    note?: string
  ) => {
    await submitDayRating.mutateAsync({ houseId, date, status, note })
  }

  // Xử lý ban hành kết luận báo cáo (Khối 7)
  const handleSetReportConclusion = async (reportId: string, text: string) => {
    await setReportConclusion.mutateAsync({ reportId, text })
  }

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      {/* Header với nút lối vào nhanh Nhật ký hoạt động S13 (EXPERT-FR-009, BZ-14) */}
      <AppHeader
        title={t('Hàng đợi công việc')}
        right={
          <PressableScale
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
              router.push('/expert/activity')
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Mở nhật ký hoạt động chuyên gia')}
          >
            <ClockCounterClockwise size={22} weight="bold" color={palette.text} />
          </PressableScale>
        }
      />

      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.xxl * 3 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefreshAll}
            tintColor={palette.text}
          />
        }
      >
        {/* KHỐI 1: PersistentScopeBar ghim cố định ở đầu trang */}
        <View style={[styles.stickyScopeContainer, { backgroundColor: palette.background }]}>
          <PersistentScopeBar />
        </View>

        <View style={styles.mainContent}>
          {/* KHỐI 2: Lưới 2x2 gồm 4 Thẻ KPI Phản Xạ Nhanh */}
          <View style={styles.kpiGrid}>
            {/* Thẻ 1: Cảnh báo suy luận P0 (chữ số màu palette.alert nếu > 0) */}
            <PressableScale
              onPress={() => scrollToSection('alerts')}
              style={[
                styles.kpiCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: kpiAlertsCount > 0 ? palette.alert : palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Cuộn tới danh sách cảnh báo suy luận P0')}
            >
              <View style={styles.kpiHeader}>
                <WarningCircle
                  size={16}
                  weight="bold"
                  color={kpiAlertsCount > 0 ? palette.alert : palette.text}
                />
                <Text
                  variant="label"
                  weight="bold"
                  color={kpiAlertsCount > 0 ? palette.alert : palette.textSecondary}
                >
                  {t('CHỜ THẨM ĐỊNH')}
                </Text>
              </View>
              <Text
                variant="display"
                weight="bold"
                style={[
                  styles.kpiValue,
                  { color: kpiAlertsCount > 0 ? palette.alert : palette.text },
                ]}
              >
                {kpiAlertsCount.toString().padStart(2, '0')}
              </Text>
              <Text variant="small" color={palette.textSecondary}>
                {t('Cảnh báo P0')}
              </Text>
            </PressableScale>

            {/* Thẻ 2: Review chủ trại */}
            <PressableScale
              onPress={() => scrollToSection('reviews')}
              style={[
                styles.kpiCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Cuộn tới danh sách review thay đổi')}
            >
              <View style={styles.kpiHeader}>
                <ClipboardText size={16} weight="bold" color={palette.text} />
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {t('REVIEW CHỦ TRẠI')}
                </Text>
              </View>
              <Text variant="display" weight="bold" style={styles.kpiValue}>
                {kpiReviewsCount.toString().padStart(2, '0')}
              </Text>
              <Text variant="small" color={palette.textSecondary}>
                {t('Yêu cầu thay đổi')}
              </Text>
            </PressableScale>

            {/* Thẻ 3: Đề xuất Fuzzy */}
            <PressableScale
              onPress={() => scrollToSection('proposals')}
              style={[
                styles.kpiCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Cuộn tới danh sách đề xuất hệ số mờ')}
            >
              <View style={styles.kpiHeader}>
                <SlidersHorizontal size={16} weight="bold" color={palette.text} />
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {t('ĐỀ XUẤT FUZZY')}
                </Text>
              </View>
              <Text variant="display" weight="bold" style={styles.kpiValue}>
                {kpiProposalsCount.toString().padStart(2, '0')}
              </Text>
              <Text variant="small" color={palette.textSecondary}>
                {t('Gợi ý hệ số từ AI')}
              </Text>
            </PressableScale>

            {/* Thẻ 4: Ngày / Báo cáo */}
            <PressableScale
              onPress={() => scrollToSection('ratings')}
              style={[
                styles.kpiCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('Cuộn tới danh sách đánh giá ngày và báo cáo')}
            >
              <View style={styles.kpiHeader}>
                <CalendarCheck size={16} weight="bold" color={palette.text} />
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {t('NGÀY / BÁO CÁO')}
                </Text>
              </View>
              <Text variant="display" weight="bold" style={styles.kpiValue}>
                {kpiRatingsAndReportsCount.toString().padStart(2, '0')}
              </Text>
              <Text variant="small" color={palette.textSecondary}>
                {t('Đánh giá & Kết luận')}
              </Text>
            </PressableScale>
          </View>

          {/* KHỐI 3: Section Cảnh báo suy luận AI khẩn cấp P0 (EXPERT-FR-003, ALERT-FR-014) */}
          <View
            onLayout={e => handleSectionLayout('alerts', e)}
            style={styles.sectionContainer}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <WarningCircle size={18} weight="bold" color={kpiAlertsCount > 0 ? palette.alert : palette.text} />
                <Text variant="heading" weight="bold">
                  {t('CẢNH BÁO SUY LUẬN AI')}
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: kpiAlertsCount > 0 ? palette.alert : palette.surfaceStrong,
                  },
                ]}
              >
                <Text
                  variant="label"
                  weight="bold"
                  color={kpiAlertsCount > 0 ? palette.onInverse : palette.textSecondary}
                >
                  {kpiAlertsCount}
                </Text>
              </View>
            </View>

            {isAlertsLoading ? (
              <View style={styles.skeletonBox}>
                <Skeleton width="100%" height={120} radius={Radius.lg} />
              </View>
            ) : pendingInferredAlerts.length > 0 ? (
              pendingInferredAlerts.map(alert => (
                <QueueInferredAlertCard key={alert._id} alert={alert} />
              ))
            ) : (
              <EmptyState
                height={80}
                message={t('Không có cảnh báo suy luận P0 nào đang chờ thẩm định.')}
              />
            )}
          </View>

          {/* KHỐI 4: Section Review thay đổi của Chủ trại (EXPERT-FR-010, SRS §6.10) */}
          <View
            onLayout={e => handleSectionLayout('reviews', e)}
            style={styles.sectionContainer}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <ClipboardText size={18} weight="bold" color={palette.text} />
                <Text variant="heading" weight="bold">
                  {t('REVIEW THAY ĐỔI CỦA CHỦ TRẠI')}
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: palette.surfaceStrong },
                ]}
              >
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {kpiReviewsCount}
                </Text>
              </View>
            </View>

            {isReviewsLoading ? (
              <View style={styles.skeletonBox}>
                <Skeleton width="100%" height={140} radius={Radius.lg} />
              </View>
            ) : pendingReviewItems.length > 0 ? (
              pendingReviewItems.map(item => (
                <QueueReviewCard
                  key={item._id}
                  item={item}
                  onAccept={handleAcceptReview}
                  onRevert={handleRevertReview}
                  isSubmitting={takeReviewAction.isPending}
                />
              ))
            ) : (
              <EmptyState
                height={80}
                message={t('Tất cả thay đổi tham số của chủ trại đã được phê duyệt hoặc hoàn nguyên.')}
              />
            )}
          </View>

          {/* KHỐI 5: Section Duyệt đề xuất hệ số mờ Fuzzy (EXPERT-FR-011, ANALYTICS-FR-010) */}
          <View
            onLayout={e => handleSectionLayout('proposals', e)}
            style={styles.sectionContainer}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <SlidersHorizontal size={18} weight="bold" color={palette.text} />
                <Text variant="heading" weight="bold">
                  {t('ĐỀ XUẤT HỆ SỐ MỜ FUZZY')}
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: palette.surfaceStrong },
                ]}
              >
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {kpiProposalsCount}
                </Text>
              </View>
            </View>

            {isProposalsLoading ? (
              <View style={styles.skeletonBox}>
                <Skeleton width="100%" height={160} radius={Radius.lg} />
              </View>
            ) : pendingProposals.length > 0 ? (
              pendingProposals.map(proposal => (
                <QueueProposalCard
                  key={proposal._id}
                  proposal={proposal}
                  onApprove={handleApproveProposal}
                  onReject={handleRejectProposal}
                  isSubmitting={takeProposalAction.isPending}
                />
              ))
            ) : (
              <EmptyState
                height={80}
                message={t('Không có đề xuất hệ số mờ mới từ thuật toán học máy.')}
              />
            )}
          </View>

          {/* KHỐI 6: Section Đánh giá ngày độc lập theo quy tắc BR-31 (EXPERT-FR-012) */}
          <View
            onLayout={e => handleSectionLayout('ratings', e)}
            style={styles.sectionContainer}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <CalendarCheck size={18} weight="bold" color={palette.text} />
                <Text variant="heading" weight="bold">
                  {t('ĐÁNH GIÁ NGÀY ĐỘC LẬP (BR-31)')}
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: palette.surfaceStrong },
                ]}
              >
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {samplePendingRatings.length}
                </Text>
              </View>
            </View>

            {samplePendingRatings.map(dayRating => (
              <QueueDayRatingCard
                key={dayRating._id}
                dayRating={dayRating}
                onSubmitRating={handleSubmitDayRating}
                isSubmitting={submitDayRating.isPending}
              />
            ))}
          </View>

          {/* KHỐI 7: Section Báo cáo sức khỏe & Kết luận (EXPERT-FR-005, 006, 013) */}
          <View
            onLayout={e => handleSectionLayout('reports', e)}
            style={styles.sectionContainer}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <CalendarCheck size={18} weight="bold" color={palette.text} />
                <Text variant="heading" weight="bold">
                  {t('BÁO CÁO SỨC KHỎE CẦN KẾT LUẬN')}
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: palette.surfaceStrong },
                ]}
              >
                <Text variant="label" weight="bold" color={palette.textSecondary}>
                  {pendingReports.length}
                </Text>
              </View>
            </View>

            {isReportsLoading ? (
              <View style={styles.skeletonBox}>
                <Skeleton width="100%" height={160} radius={Radius.lg} />
              </View>
            ) : pendingReports.length > 0 ? (
              pendingReports.map(report => (
                <QueueReportCard
                  key={report._id}
                  report={report}
                  onSetConclusion={handleSetReportConclusion}
                  isSubmitting={setReportConclusion.isPending}
                />
              ))
            ) : (
              <EmptyState
                height={80}
                message={t('Tất cả báo cáo sức khỏe đã được hoàn tất kết luận chuyên môn.')}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  stickyScopeContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    zIndex: 10,
  },
  mainContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    elevation: 0,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  kpiValue: {
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
    marginBottom: Spacing.xs / 2,
  },
  sectionContainer: {
    marginBottom: Spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  skeletonBox: {
    marginBottom: Spacing.sm,
  },
  alertCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  alertTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTimeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertTitleRow: {
    marginTop: Spacing.xs,
  },
  alertLocationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  alertDescription: {
    marginTop: Spacing.xs,
    fontSize: 13,
    lineHeight: 18,
  },
  alertActionButton: {
    height: 44,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
})
