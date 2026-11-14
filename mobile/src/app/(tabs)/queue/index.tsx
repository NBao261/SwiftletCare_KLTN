import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useQueryClient } from '@tanstack/react-query'
import { onNotificationNew } from '@/services/socket/socketClient'
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
import { QueueProposalCard } from '@/components/expert/queue/QueueProposalCard'
import { QueueReportCard } from '@/components/expert/queue/QueueReportCard'
import { QueueReviewCard } from '@/components/expert/queue/QueueReviewCard'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { ExpertHeaderPicker, PersistentScopeBar } from '@/components/layout/PersistentScopeBar'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PressableScale } from '@/components/ui/pressable-scale'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { Radius, Spacing } from '@/constants/theme'
import { useInferredAlerts } from '@/hooks/expert/useInferredAlerts'
import { useHealthReports, useSetReportConclusion } from '@/hooks/expert/useExpertReports'
import {
  useExpertProposals,
  useExpertReviewItems,
  useTakeProposalAction,
  useTakeReviewAction,
} from '@/hooks/expert/useExpertReviews'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import { useExpertScopeStore } from '@/stores/expertScopeStore'
import type { InferredAlert, ReviewItem, CoefficientProposal, HouseHealthReportSummary } from '@/types/expert.types'
import { formatTimeAgo } from '@/utils/date.utils'
import { getInferredAlertDescription, getInferredAlertLabel } from '@/utils/inferredAlert.utils'
import { t } from '@/utils/i18n.utils'

const KPI_TILE_HEIGHT = 112

interface QueueInferredAlertCardProps {
  alert: InferredAlert
}

/**
 * Thẻ Cảnh báo suy luận AI khẩn cấp P0 trong Hàng đợi (EXPERT-FR-003, ALERT-FR-014).
 * Chuẩn hóa bằng <Card> phẳng không viền theo design system FARM_OWNER.
 * Chạm [Kiểm tra ngay →] chuyển thẳng sang tab Thẩm định với alertId chọn sẵn đúng 1 chạm.
 */
function QueueInferredAlertCard({ alert }: QueueInferredAlertCardProps) {
  const palette = usePalette()
  const router = useRouter()
  const { zoneById, houseById } = useZoneDirectory()

  const alertTitle = getInferredAlertLabel(alert.type)
  const alertDesc = alert.message || getInferredAlertDescription(alert.type)
  const timeStr = formatTimeAgo(alert.created_at)
  const zone = alert.zone_id ? zoneById.get(alert.zone_id) : undefined
  const zoneName = zone?.name
  const houseId = alert.house_id || zone?.house_id
  const houseName = houseId ? houseById.get(houseId)?.name : undefined
  const locationLabel =
    [houseName, zoneName].filter(Boolean).join(' › ') ||
    (alert.zone_id ? t('Tầng / Zone') : t('Toàn nhà'))

  const handleInspect = () => {
    router.push({
      pathname: '/(tabs)/verdicts',
      params: { alertId: alert._id },
    })
  }

  return (
    <Card style={styles.alertCard}>
      {/* Hàng 1: Badge mức độ Báo động & Thời gian tương đối */}
      <View style={styles.alertTopRow}>
        <View style={[styles.alertBadgePill, { backgroundColor: palette.severityP2 }]}>
          <View style={[styles.alertDot, { backgroundColor: palette.alert }]} />
          <Text variant="label" weight="bold" color={palette.severityP2Text}>
            {t('Báo động')}
          </Text>
        </View>

        <View style={styles.alertTimeWrapper}>
          <Clock size={12} color={palette.textSecondary} />
          <Text variant="small" color={palette.textSecondary}>
            {timeStr}
          </Text>
        </View>
      </View>

      {/* Hàng 2: Tên sự cố & Vị trí Zone */}
      <View style={styles.alertTitleRow}>
        <Text variant="heading" weight="semiBold">
          {alertTitle}
        </Text>
        <View style={styles.alertLocationWrapper}>
          <MapPin size={13} color={palette.textSecondary} />
          <Text variant="small" color={palette.textSecondary}>
            {locationLabel}
          </Text>
        </View>
      </View>

      {/* Hàng 3: Tóm tắt viễn trắc */}
      <Text variant="body" color={palette.text} numberOfLines={2} style={styles.alertDescription}>
        {alertDesc}
      </Text>

      {/* Hàng 4: Nút hành động 1 chạm [Kiểm tra ngay →] */}
      <PressableScale
        onPress={handleInspect}
        style={[
          styles.alertActionButton,
          {
            backgroundColor: palette.inverse,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('Kiểm tra ngay sự cố này')}
      >
        <Text variant="body" weight="semiBold" color={palette.onInverse}>
          {t('Kiểm tra ngay')}
        </Text>
        <ArrowRight size={16} weight="bold" color={palette.onInverse} />
      </PressableScale>
    </Card>
  )
}

/**
 * [PHẦN 1] MOBILE — MENU HÀNG ĐỢI (src/app/(tabs)/queue/index.tsx)
 * Kiến trúc 1 màn hình duy nhất (One-Screen Consolidated) cho Domain Expert,
 * đồng bộ 100% quy chuẩn thẩm mỹ Calm Industrial với nhánh FARM_OWNER.
 */
export default function QueueScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const router = useRouter()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const sectionYPositions = useRef<Record<string, number>>({})

  const queryClient = useQueryClient()

  // Realtime WebSocket: tự động làm mới hàng đợi khi có thông báo mới (EXPERT-FR-007)
  useEffect(() => {
    const handleNotification = () => {
      void queryClient.invalidateQueries({ queryKey: ['expert'] })
      void queryClient.invalidateQueries({ queryKey: ['inferred-alerts'] })
    }
    const unsubscribe = onNotificationNew(handleNotification)
    return unsubscribe
  }, [queryClient])

  const selectedFarmId = useExpertScopeStore(state => state.selectedFarmId)
  const selectedHouseId = useExpertScopeStore(state => state.selectedHouseId)
  const selectedZoneId = useExpertScopeStore(state => state.selectedZoneId)


  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const {
    data: alertsResponse,
    isLoading: isAlertsLoading,
    isRefetching: isAlertsRefetching,
    refetch: refetchAlerts,
  } = useInferredAlerts({
    farm_id: selectedFarmId || undefined,
    zone_id: selectedZoneId || undefined,
  })

  const {
    data: reviewsResponse,
    isLoading: isReviewsLoading,
    isRefetching: isReviewsRefetching,
    refetch: refetchReviews,
  } = useExpertReviewItems({
    farm_id: selectedFarmId || undefined,
    zone_id: selectedZoneId || undefined,
    status: 'PENDING_REVIEW',
  })
  const takeReviewAction = useTakeReviewAction()

  const {
    data: proposalsResponse,
    isLoading: isProposalsLoading,
    isRefetching: isProposalsRefetching,
    refetch: refetchProposals,
  } = useExpertProposals({
    farm_id: selectedFarmId || undefined,
    zone_id: selectedZoneId || undefined,
    status: 'PROPOSED',
  })
  const takeProposalAction = useTakeProposalAction()

  const {
    data: reportsResponse,
    isLoading: isReportsLoading,
    isRefetching: isReportsRefetching,
    refetch: refetchReports,
  } = useHealthReports({
    farm_id: selectedFarmId || undefined,
    house_id: selectedHouseId || undefined,
    has_conclusion: false,
  })
  const setReportConclusion = useSetReportConclusion()

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

  // Danh sách đã lọc has_conclusion=false ở server nên mọi báo cáo trả về đều đang chờ kết luận
  const pendingReports = useMemo<HouseHealthReportSummary[]>(() => {
    return (reportsResponse?.data || []).filter(r => !r.has_conclusion)
  }, [reportsResponse])

  const unfinalizedReportsCount = pendingReports.length

  const kpiAlertsCount = pendingInferredAlerts.length
  const kpiReviewsCount = pendingReviewItems.length
  const kpiProposalsCount = pendingProposals.length
  const kpiReportsCount = unfinalizedReportsCount

  const isRefreshing =
    isAlertsRefetching ||
    isReviewsRefetching ||
    isProposalsRefetching ||
    isReportsRefetching

  const handleRefreshAll = () => {
    void refetchAlerts()
    void refetchReviews()
    void refetchProposals()
    void refetchReports()
  }

  const handleSectionLayout = (key: string, event: LayoutChangeEvent) => {
    sectionYPositions.current[key] = event.nativeEvent.layout.y
  }

  const scrollToSection = (key: string) => {
    const targetY = sectionYPositions.current[key]
    if (targetY != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, targetY - 12), animated: true })
    }
  }

  const handleAcceptReview = async (itemId: string) => {
    try {
      await takeReviewAction.mutateAsync({ itemId, action: 'ACCEPT' })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      showToast(t('Đã chấp thuận thay đổi tham số của chủ nhà'))
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      showToast(t('Không thể chấp thuận thay đổi, vui lòng thử lại'))
    }
  }

  const handleRevertReview = async (itemId: string) => {
    try {
      await takeReviewAction.mutateAsync({ itemId, action: 'REVERT' })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      showToast(t('Đã hoàn nguyên tham số về giá trị an toàn'))
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      showToast(t('Không thể hoàn nguyên tham số, vui lòng thử lại'))
    }
  }

  const handleApproveProposal = async (proposalId: string) => {
    try {
      await takeProposalAction.mutateAsync({ proposalId, action: 'APPROVE' })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      showToast(t('Đã duyệt áp dụng bộ hệ số độ ẩm & gió'))
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      showToast(t('Không thể duyệt đề xuất, vui lòng thử lại'))
    }
  }

  const handleRejectProposal = async (proposalId: string, reason: string) => {
    try {
      await takeProposalAction.mutateAsync({
        proposalId,
        action: 'REJECT',
        rejectionReason: reason,
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      showToast(t('Đã từ chối đề xuất và gửi phản hồi'))
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      showToast(t('Không thể từ chối đề xuất, vui lòng thử lại'))
    }
  }

  const handleSetReportConclusion = async (reportId: string, text: string) => {
    try {
      await setReportConclusion.mutateAsync({ reportId, text })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      showToast(t('Đã ban hành kết luận chuyên môn cho báo cáo'))
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      showToast(t('Không thể lưu kết luận báo cáo, vui lòng thử lại'))
    }
  }

  const alertTileWarning = kpiAlertsCount > 0
  const alertTileSecondary = alertTileWarning ? palette.severityP2Text : palette.textSecondary

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      {/* Header chọn Nhà yến trực tiếp ở leading + nút Nhật ký hoạt động ở right */}
      <AppHeader
        leading={<ExpertHeaderPicker />}
        right={
          <PressableScale
            onPress={() => router.push('/expert/activity')}
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_OVERLAP + Spacing.xxl * 3 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefreshAll}
            tintColor={palette.text}
          />
        }
      >
        {/* KHỐI 1: Hàng Chip chọn Tầng & Thời gian ghim cố định đầu trang */}
        <View style={[styles.stickyScopeContainer, { backgroundColor: palette.background }]}>
          <PersistentScopeBar />
        </View>

        <View style={styles.mainContent}>
          {/* KHỐI 2: Lưới 2x2 gồm 4 Ô KPI chuẩn KpiTile của FARM_OWNER */}
          <View style={styles.kpiGrid}>
            {/* Ô 1: Cảnh báo chờ kiểm tra */}
            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => scrollToSection('alerts')}
                style={[
                  styles.kpiTile,
                  {
                    backgroundColor: alertTileWarning ? palette.severityP2 : palette.surface,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('Cuộn tới danh sách cảnh báo')}
              >
                <Text variant="small" color={alertTileSecondary} numberOfLines={1}>
                  {t('Chờ kiểm tra')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} đang mở', { count: kpiAlertsCount })}
                </Text>
                <Text variant="small" color={alertTileSecondary} numberOfLines={1}>
                  {kpiAlertsCount > 0 ? t('Sự cố cần xem ngay') : t('Chưa có cảnh báo')}
                </Text>
              </PressableScale>
            </View>

            {/* Ô 2: Yêu cầu từ chủ nhà */}
            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => scrollToSection('reviews')}
                style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Cuộn tới danh sách yêu cầu thay đổi')}
              >
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Chủ nhà xin đổi')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} yêu cầu', { count: kpiReviewsCount })}
                </Text>
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Chờ duyệt ngưỡng')}
                </Text>
              </PressableScale>
            </View>

            {/* Ô 3: Đề xuất độ ẩm & gió */}
            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => scrollToSection('proposals')}
                style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Cuộn tới danh sách đề xuất độ ẩm và gió')}
              >
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Gợi ý độ ẩm & gió')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} đề xuất', { count: kpiProposalsCount })}
                </Text>
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Tự động hóa từ AI')}
                </Text>
              </PressableScale>
            </View>

            {/* Ô 4: Báo cáo chờ kết luận */}
            <View style={styles.kpiCell}>
              <PressableScale
                onPress={() => scrollToSection('reports')}
                style={[styles.kpiTile, { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('Cuộn tới danh sách báo cáo chờ kết luận')}
              >
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Báo cáo chờ kết luận')}
                </Text>
                <Text variant="heading" weight="semiBold" numberOfLines={1} style={styles.kpiValue}>
                  {t('{count} kỳ', { count: kpiReportsCount })}
                </Text>
                <Text variant="small" color={palette.textSecondary} numberOfLines={1}>
                  {t('Đánh giá định kỳ')}
                </Text>
              </PressableScale>
            </View>
          </View>

          {/* KHỐI 3: Section Cảnh báo bất thường */}
          <View
            onLayout={e => handleSectionLayout('alerts', e)}
            style={styles.sectionContainer}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <WarningCircle size={18} weight="bold" color={kpiAlertsCount > 0 ? palette.alert : palette.text} />
                <Text variant="heading" weight="semiBold">
                  {t('Cảnh báo bất thường')}
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: kpiAlertsCount > 0 ? palette.severityP2 : palette.surface,
                  },
                ]}
              >
                <Text
                  variant="label"
                  weight="bold"
                  color={kpiAlertsCount > 0 ? palette.severityP2Text : palette.textSecondary}
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
                message={t('Không có cảnh báo bất thường nào cần kiểm tra.')}
              />
            )}
          </View>

          {/* KHỐI 4: Section Yêu cầu đổi thông số từ Chủ nhà */}
          <View
            onLayout={e => handleSectionLayout('reviews', e)}
            style={styles.sectionContainer}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <ClipboardText size={18} weight="bold" color={palette.text} />
                <Text variant="heading" weight="semiBold">
                  {t('Yêu cầu đổi thông số từ chủ nhà')}
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: palette.surface },
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
                message={t('Tất cả yêu cầu thay đổi từ chủ nhà đã được xử lý xong.')}
              />
            )}
          </View>

          {/* KHỐI 5: Section Đề xuất độ ẩm & gió tự động */}
          <View
            onLayout={e => handleSectionLayout('proposals', e)}
            style={styles.sectionContainer}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <SlidersHorizontal size={18} weight="bold" color={palette.text} />
                <Text variant="heading" weight="semiBold">
                  {t('Đề xuất độ ẩm & gió tự động')}
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: palette.surface },
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
                message={t('Không có đề xuất độ ẩm & gió mới từ AI.')}
              />
            )}
          </View>

          {/* KHỐI 6: Section Báo cáo vi khí hậu & Kết luận */}
          <View
            onLayout={e => handleSectionLayout('reports', e)}
            style={styles.sectionContainer}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <CalendarCheck size={18} weight="bold" color={palette.text} />
                <Text variant="heading" weight="semiBold">
                  {t('Báo cáo vi khí hậu & kết luận')}
                </Text>
              </View>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: palette.surface },
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
                message={t('Tất cả báo cáo vi khí hậu đã được hoàn tất kết luận chuyên môn.')}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {toastMessage && (
        <Toast message={toastMessage} bottomOffset={TAB_BAR_OVERLAP + Spacing.lg} />
      )}
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
    zIndex: 10,
  },
  mainContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  kpiCell: {
    flexGrow: 1,
    flexBasis: '40%',
  },
  kpiTile: {
    height: KPI_TILE_HEIGHT,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    justifyContent: 'space-between',
  },
  kpiValue: {
    fontVariant: ['tabular-nums'],
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
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: 0,
  },
  alertTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
